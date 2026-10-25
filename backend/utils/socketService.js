/**
 * socketService.js  (backend)
 *
 * Two Socket.IO namespaces:
 *
 *   /device  — ESP8266 / Arduino devices connect here
 *              Events IN  (device → backend):
 *                device:data      { apiKey, deviceId, type, zone, temp, humidity,
 *                                   moisture, flow, ph, light, pressure,
 *                                   waterLevel, lcdMessage, sirenActive }
 *                device:register  { apiKey, deviceId, type, zone }
 *
 *              Events OUT (backend → device):
 *                device:command   { command, zoneId, lcdMessage }
 *                device:ack       { ok: true|false, message }
 *
 *   /        — Frontend browsers connect here (default namespace)
 *              Events OUT (backend → frontend):
 *                sensor:update    { id, online, lastSeen, temp, humidity, ... }
 *                sensor:offline   { id, online:false, lastSeen }
 *                sensor:alert     { id, type, message }
 *                device:connected { id, type, zone }
 *                device:disconnected { id }
 */

const { Server }    = require('socket.io');
const Sensor        = require('../models/Sensor');
const SensorLog     = require('../models/SensorLog');
const History       = require('../models/History');

const DEVICE_API_KEY = process.env.DEVICE_API_KEY || 'sis_device_key_2025';

let io         = null;   // default namespace  (frontend)
let deviceNs   = null;   // /device namespace  (ESP8266)

// Track which socket belongs to which deviceId for clean disconnect handling
const socketToDevice = new Map();  // socketId → deviceId

// ── Init ──────────────────────────────────────────────────────────────────────
function init(httpServer, allowedOrigins = []) {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, cb) => {
        // Allow no-origin requests (ESP8266 has no Origin header)
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error(`Socket CORS: origin ${origin} not allowed`));
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // ── /device namespace — ESP8266 connections ─────────────────────────────────
  deviceNs = io.of('/device');

  deviceNs.on('connection', (socket) => {
    console.log(`  [Socket.IO/device] Device socket connected: ${socket.id}`);

    // ── device:register — device announces itself ──────────────────────────
    socket.on('device:register', async (payload) => {
      try {
        const { apiKey, deviceId, macAddress, type, zone, firmwareVersion, signalStrength } = payload || {};
        if (apiKey !== DEVICE_API_KEY) {
          socket.emit('device:ack', { ok: false, message: 'Invalid API key.' });
          return socket.disconnect(true);
        }
        if (!deviceId) {
          return socket.emit('device:ack', { ok: false, message: 'deviceId is required.' });
        }

        const id  = String(deviceId).toUpperCase();
        const mac = macAddress ? String(macAddress).toUpperCase().trim() : '';
        socketToDevice.set(socket.id, id);
        socket.join(`device:${id}`);
        socket.deviceId = id;

        const setFields = {
          type:            type || 'ESP8266',
          zoneName:        zone || '',
          online:          true,
          lastSeen:        new Date(),
          connectionStatus:'online',
        };
        if (mac)              setFields.macAddress      = mac;
        if (firmwareVersion)  setFields.firmwareVersion = String(firmwareVersion);
        if (signalStrength !== undefined) setFields.signalStrength = Number(signalStrength);

        const sensor = await Sensor.findOneAndUpdate(
          { deviceId: id },
          { $set: setFields },
          { upsert: true, new: true }
        );

        console.log(`  [Socket.IO/device] Registered: ${id} MAC=${mac || 'N/A'} (${type || 'ESP8266'}) zone="${zone || ''}"`);
        socket.emit('device:ack', { ok: true, message: `Registered as ${id}` });

        io.emit('device:connected', {
          id, mac, type: type || 'ESP8266', zone: zone || '',
          firmwareVersion: sensor.firmwareVersion || '',
          signalStrength:  sensor.signalStrength  || 0,
        });

      } catch (err) {
        console.error('[Socket.IO/device] register error:', err.message);
        socket.emit('device:ack', { ok: false, message: 'Server error during registration.' });
      }
    });

    // ── device:data — ESP8266 pushes sensor readings ───────────────────────
    socket.on('device:data', async (payload) => {
      try {
        const {
          apiKey, deviceId,
          type, zone, macAddress,
          temp, humidity, moisture, flow, ph,
          light, pressure, waterLevel, lcdMessage, sirenActive,
          signalStrength, firmwareVersion,
        } = payload || {};

        // Authenticate
        if (apiKey !== DEVICE_API_KEY) {
          return socket.emit('device:ack', { ok: false, message: 'Invalid API key.' });
        }
        if (!deviceId) {
          return socket.emit('device:ack', { ok: false, message: 'deviceId required.' });
        }

        const id  = String(deviceId).toUpperCase();
        const now = new Date();

        // Validate ranges
        const errors = [];
        if (temp        !== undefined && (temp < -50 || temp > 100))          errors.push('temp out of range');
        if (humidity    !== undefined && (humidity < 0 || humidity > 100))    errors.push('humidity out of range');
        if (moisture    !== undefined && (moisture < 0 || moisture > 100))    errors.push('moisture out of range');
        if (flow        !== undefined && (flow < 0 || flow > 9999))           errors.push('flow out of range');
        if (ph          !== undefined && (ph < 0 || ph > 14))                 errors.push('ph out of range');
        if (light       !== undefined && (light < 0 || light > 200000))       errors.push('light out of range');
        if (pressure    !== undefined && (pressure < 800 || pressure > 1200)) errors.push('pressure out of range');
        if (waterLevel  !== undefined && (waterLevel < 0 || waterLevel > 100))errors.push('waterLevel out of range');
        if (errors.length) {
          return socket.emit('device:ack', { ok: false, message: errors.join(', ') });
        }

        const reading = {
          temp:        temp        ?? 0,
          humidity:    humidity    ?? 0,
          moisture:    moisture    ?? 0,
          flow:        flow        ?? 0,
          ph:          ph          ?? 0,
          light:       light       ?? 0,
          pressure:    pressure    ?? 0,
          waterLevel:  waterLevel  ?? 0,
          lcdMessage:  lcdMessage  ?? '',
          sirenActive: sirenActive ?? false,
          updatedAt:   now,
        };

        const setDoc = {
          type:            type || 'ESP8266',
          zoneName:        zone || '',
          online:          true,
          lastSeen:        now,
          connectionStatus:'online',
          reading,
        };
        if (macAddress)      setDoc.macAddress      = String(macAddress).toUpperCase().trim();
        if (firmwareVersion) setDoc.firmwareVersion = String(firmwareVersion);
        if (signalStrength !== undefined) setDoc.signalStrength = Number(signalStrength);

        await Sensor.findOneAndUpdate(
          { deviceId: id },
          { $set: setDoc },
          { upsert: true, new: true }
        );

        // Append to time-series log
        await SensorLog.create({ deviceId: id, zoneName: zone || '', ...reading });

        // Acknowledge back to device
        socket.emit('device:ack', { ok: true, timestamp: now });

        // ── Emit to frontend (default namespace) ────────────────────────────
        const frontendPayload = {
          id,
          type:           type || 'ESP8266',
          zone:           zone || '',
          mac:            macAddress ? String(macAddress).toUpperCase().trim() : '',
          signalStrength: signalStrength !== undefined ? Number(signalStrength) : 0,
          firmwareVersion:firmwareVersion || '',
          online:         true,
          lastSeen:       now,
          ...reading,
        };
        io.emit('sensor:update', frontendPayload);
        io.to(`sensor:${id}`).emit('sensor:update', frontendPayload);

        // ── Threshold alerts ─────────────────────────────────────────────────
        const alertQueue = [];

        if (moisture !== undefined && moisture < 30) {
          alertQueue.push({ event: 'Low Moisture Alert', alertType: 'low_moisture',
            msg: `${id}: moisture at ${moisture}%`, histType: 'warning' });
        }
        if (temp !== undefined && temp > 35) {
          alertQueue.push({ event: 'High Temp Alert', alertType: 'high_temp',
            msg: `${id}: temperature ${temp}°C`, histType: 'danger' });
        }
        if (waterLevel !== undefined && waterLevel < 20) {
          alertQueue.push({ event: 'Low Water Level Alert', alertType: 'low_water',
            msg: `${id}: water level at ${waterLevel}%`, histType: 'warning' });
        }
        if (ph !== undefined && (ph < 5.5 || ph > 7.5)) {
          alertQueue.push({ event: 'pH Out of Range Alert', alertType: 'abnormal_ph',
            msg: `${id}: pH ${ph} (normal 5.5–7.5)`, histType: 'warning' });
        }
        if (sirenActive) {
          alertQueue.push({ event: 'Siren Activated', alertType: 'siren_active',
            msg: `${id}: siren triggered`, histType: 'danger' });
        }

        for (const a of alertQueue) {
          await History.create({
            event: a.event, userName: 'System',
            zoneName: zone || '—', details: a.msg, type: a.histType,
          }).catch(() => {});
          io.emit('sensor:alert', { id, type: a.alertType, message: a.msg });
        }

        // ── Deliver any pending command back to this device ──────────────────
        const sensor = await Sensor.findOne({ deviceId: id })
          .select('pendingCommand commandZoneId').lean();

        if (sensor?.pendingCommand && sensor.pendingCommand !== 'none') {
          socket.emit('device:command', {
            command:    sensor.pendingCommand,
            zoneId:     sensor.commandZoneId || '',
            lcdMessage: sensor.pendingCommand === 'lcd_message' ? sensor.commandZoneId : '',
          });
          // Clear command so it only fires once
          await Sensor.updateOne(
            { deviceId: id },
            { $set: { pendingCommand: 'none', commandZoneId: '' } }
          );
        }

      } catch (err) {
        console.error('[Socket.IO/device] data error:', err.message);
        socket.emit('device:ack', { ok: false, message: 'Server error.' });
      }
    });

    // ── disconnect ─────────────────────────────────────────────────────────
    socket.on('disconnect', async (reason) => {
      const id = socketToDevice.get(socket.id) || socket.deviceId;
      socketToDevice.delete(socket.id);

      if (id) {
        console.log(`  [Socket.IO/device] Device disconnected: ${id} (${reason})`);
        try {
          await Sensor.updateOne({ deviceId: id }, { $set: { online: false } });
        } catch (_) {}
        // Notify frontend
        io.emit('sensor:offline', { id, online: false, lastSeen: new Date() });
        io.emit('device:disconnected', { id });
      } else {
        console.log(`  [Socket.IO/device] Unknown socket disconnected: ${socket.id}`);
      }
    });
  });

  // ── Default namespace — frontend browser connections ───────────────────────
  io.on('connection', (socket) => {
    console.log(`  [Socket.IO] Frontend connected : ${socket.id}`);

    // Frontend can subscribe to a per-device room for targeted updates
    socket.on('subscribe:sensor', (deviceId) => {
      if (deviceId) {
        socket.join(`sensor:${String(deviceId).toUpperCase()}`);
      }
    });

    socket.on('unsubscribe:sensor', (deviceId) => {
      if (deviceId) socket.leave(`sensor:${String(deviceId).toUpperCase()}`);
    });

    // Frontend can push a command to a specific device (owner/admin — JWT check is done in HTTP layer)
    socket.on('send:command', async ({ deviceId, command, payload: cmdPayload }) => {
      if (!deviceId || !command) return;
      const id = String(deviceId).toUpperCase();
      await Sensor.updateOne(
        { deviceId: id },
        { $set: { pendingCommand: command, commandZoneId: cmdPayload || '' } }
      ).catch(() => {});
      // Forward to device if it's connected via socket
      deviceNs.to(`device:${id}`).emit('device:command', {
        command, zoneId: cmdPayload || '',
        lcdMessage: command === 'lcd_message' ? cmdPayload : '',
      });
    });

    socket.on('disconnect', () => {
      console.log(`  [Socket.IO] Frontend disconnected: ${socket.id}`);
    });
  });

  console.log('  [Socket.IO] Server initialised  (namespaces: / + /device)');
  return io;
}

// ── Emit helpers (called from HTTP routes too) ────────────────────────────────

function emitSensorUpdate(deviceId, data) {
  if (!io) return;
  const payload = { ...data, id: deviceId, online: true };
  io.emit('sensor:update', payload);
  io.to(`sensor:${deviceId.toUpperCase()}`).emit('sensor:update', payload);
}

function emitSensorOffline(deviceId, lastSeen) {
  if (!io) return;
  const payload = { id: deviceId, online: false, lastSeen };
  io.emit('sensor:offline', payload);
  io.to(`sensor:${deviceId.toUpperCase()}`).emit('sensor:offline', payload);
}

function emitSensorAlert(deviceId, alertType, message) {
  if (!io) return;
  io.emit('sensor:alert', { id: deviceId, type: alertType, message });
}

function getIO()       { return io; }
function getDeviceNs() { return deviceNs; }

module.exports = {
  init,
  emitSensorUpdate,
  emitSensorOffline,
  emitSensorAlert,
  getIO,
  getDeviceNs,
};
