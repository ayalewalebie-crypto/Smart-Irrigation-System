/**
 * Sensors Route
 *
 * Bidirectional ESP8266 flow (Socket.IO — primary):
 *   ESP8266  ──► socket.emit('device:data')      → /device namespace → saves to MongoDB + pushes to frontend
 *   ESP8266  ◄── socket.on('device:command')     ← backend delivers command instantly
 *
 * Bidirectional ESP8266 flow (HTTP — fallback / legacy):
 *   ESP8266  ──►  POST /api/sensors/:id/data     (push readings to MongoDB)
 *   ESP8266  ◄──  GET  /api/sensors/:id/command  (poll commands from MongoDB)
 *
 * Frontend flow:
 *   Frontend ──►  GET  /api/sensors              (initial load of all sensor data)
 *   Frontend ──►  POST /api/sensors/:id/irrigate (queue irrigate command → device)
 *   Frontend ──►  POST /api/sensors/:id/siren    (queue siren command   → device)
 *   Frontend ──►  POST /api/sensors/:id/lcd      (queue LCD message     → device)
 *   Frontend ──►  PUT  /api/sensors/:id/thresholds (update alert thresholds)
 */

const express   = require('express');
const { body, param, validationResult } = require('express-validator');
const Sensor    = require('../models/Sensor');
const SensorLog = require('../models/SensorLog');
const History   = require('../models/History');
const { authenticate, authorize } = require('../middleware/auth');
const socketService = require('../utils/socketService');
require('dotenv').config();

const router = express.Router();

// ── Validation helper ─────────────────────────────────────────────────────────
function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ message: errors.array().map(e => e.msg).join(' | ') });
    return false;
  }
  return true;
}

// ── Device ID sanitiser — alphanumeric + dash/underscore, max 32 chars ────────
const DEVICE_ID_RULE = param('id')
  .trim()
  .matches(/^[a-zA-Z0-9_\-]+$/).withMessage('Invalid device ID format.')
  .isLength({ max: 32 }).withMessage('Device ID too long.');

// ── GET /api/sensors — Frontend: live sensor list ─────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const sensors = await Sensor.find().sort({ deviceId: 1 }).lean();
    return res.json(sensors.map(s => ({
      id:              s.deviceId,
      _id:             s._id,
      mac:             s.macAddress || '',
      name:            s.name || '',
      type:            s.type,
      zone:            s.zoneName,
      online:          s.online,
      lastSeen:        s.lastSeen,
      connectionStatus:s.connectionStatus || 'offline',
      firmwareVersion: s.firmwareVersion  || '',
      signalStrength:  s.signalStrength   || 0,
      pumpStatus:      s.pumpStatus       || 'off',
      sirenActive:     s.reading?.sirenActive ?? false,
      temp:            s.reading?.temp        ?? 0,
      humidity:        s.reading?.humidity    ?? 0,
      moisture:        s.reading?.moisture    ?? 0,
      flow:            s.reading?.flow        ?? 0,
      ph:              s.reading?.ph          ?? 0,
      light:           s.reading?.light       ?? 0,
      pressure:        s.reading?.pressure    ?? 0,
      waterLevel:      s.reading?.waterLevel  ?? 0,
      lcdMessage:      s.reading?.lcdMessage  ?? '',
    })));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── GET /api/sensors/:id — single sensor detail ───────────────────────────────

router.get('/:id/history', authenticate, async (req, res) => {
  try {
    const { from, to } = req.query;
    const filter = { deviceId: req.params.id.toUpperCase() };
    if (from || to) {
      filter.recordedAt = {};
      if (from) filter.recordedAt.$gte = new Date(from);
      if (to)   filter.recordedAt.$lte = new Date(to + 'T23:59:59');
    }
    const logs = await SensorLog.find(filter)
      .sort({ recordedAt: -1 })
      .limit(500)
      .lean();
    return res.json(logs);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── GET /api/sensors/:id/command ─────────────────────────────────────────────
// ESP8266 polls this endpoint to receive commands queued by the frontend.
// No JWT — uses device API key. After delivering the command, resets to 'none'.

router.get('/:id/command', async (req, res) => {
  try {
    const { apiKey } = req.query;
    const expectedKey = process.env.DEVICE_API_KEY || 'sis_device_key_2025';
    if (apiKey !== expectedKey)
      return res.status(401).json({ message: 'Invalid device API key.' });

    const sensor = await Sensor.findOne({ deviceId: req.params.id.toUpperCase() }).lean();
    if (!sensor)
      return res.json({ command: 'none', zoneId: '' });

    const { pendingCommand, commandZoneId } = sensor;

    // Clear the command after delivering it so it only executes once
    if (pendingCommand !== 'none') {
      await Sensor.updateOne(
        { deviceId: req.params.id.toUpperCase() },
        { $set: { pendingCommand: 'none', commandZoneId: '' } }
      );
    }

    return res.json({
      command:    pendingCommand || 'none',
      zoneId:     commandZoneId || '',
      lcdMessage: pendingCommand === 'lcd_message' ? commandZoneId : '',
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── GET /api/sensors/:id ──────────────────────────────────────────────────────

router.get('/:id', authenticate, async (req, res) => {
  try {
    const sensor = await Sensor.findOne({ deviceId: req.params.id.toUpperCase() }).lean();
    if (!sensor) return res.status(404).json({ message: 'Sensor not found.' });
    return res.json({
      id:       sensor.deviceId,
      type:     sensor.type,
      zone:     sensor.zoneName,
      online:   sensor.online,
      lastSeen: sensor.lastSeen,
      ...(sensor.reading || {}),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── POST /api/sensors/:id/data ────────────────────────────────────────────────
// ESP8266 pushes live readings here — no JWT, uses device API key

router.post('/:id/data', [
  DEVICE_ID_RULE,
  body('temp').optional().isFloat({ min: -50, max: 100 }).withMessage('temp out of range (-50–100).'),
  body('humidity').optional().isFloat({ min: 0, max: 100 }).withMessage('humidity out of range (0–100).'),
  body('moisture').optional().isFloat({ min: 0, max: 100 }).withMessage('moisture out of range (0–100).'),
  body('flow').optional().isFloat({ min: 0, max: 9999 }).withMessage('flow out of range (0–9999).'),
  body('ph').optional().isFloat({ min: 0, max: 14 }).withMessage('ph out of range (0–14).'),
  body('light').optional().isFloat({ min: 0, max: 200000 }).withMessage('light out of range (0–200000).'),
  body('pressure').optional().isFloat({ min: 800, max: 1200 }).withMessage('pressure out of range (800–1200 hPa).'),
  body('waterLevel').optional().isFloat({ min: 0, max: 100 }).withMessage('waterLevel out of range (0–100).'),
  body('lcdMessage').optional().isString().isLength({ max: 64 }).withMessage('lcdMessage max 64 chars.'),
  body('sirenActive').optional().isBoolean().withMessage('sirenActive must be boolean.'),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const {
      apiKey, type, zone,
      temp, humidity, moisture, flow, ph, light, pressure,
      waterLevel, lcdMessage, sirenActive,
    } = req.body;

    const expectedKey = process.env.DEVICE_API_KEY || 'sis_device_key_2025';
    if (apiKey !== expectedKey)
      return res.status(401).json({ message: 'Invalid device API key.' });

    const deviceId = req.params.id.toUpperCase();
    const now      = new Date();
    const reading  = {
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

    // Upsert sensor — auto-registers new devices on first push
    await Sensor.findOneAndUpdate(
      { deviceId },
      { $set: { type: type || 'Unknown', zoneName: zone || '', online: true, lastSeen: now, reading } },
      { upsert: true, new: true }
    );

    // Log to history
    await SensorLog.create({ deviceId, zoneName: zone || '', ...reading });

    // ── Real-time push to all connected frontend clients via Socket.IO ────────
    socketService.emitSensorUpdate(deviceId, {
      id:         deviceId,
      type:       type || 'Unknown',
      zone:       zone || '',
      online:     true,
      lastSeen:   now,
      temp:       temp        ?? 0,
      humidity:   humidity    ?? 0,
      moisture:   moisture    ?? 0,
      flow:       flow        ?? 0,
      ph:         ph          ?? 0,
      light:      light       ?? 0,
      pressure:   pressure    ?? 0,
      waterLevel: waterLevel  ?? 0,
      lcdMessage: lcdMessage  ?? '',
      sirenActive:sirenActive ?? false,
    });

    // Auto-alerts
    if (moisture !== undefined && moisture < 30) {
      await History.create({
        event: 'Low Moisture Alert', userName: 'System',
        zoneName: zone || '—',
        details: `${deviceId}: moisture at ${moisture}%`,
        type: 'warning',
      });
      socketService.emitSensorAlert(deviceId, 'low_moisture', `${deviceId}: moisture at ${moisture}%`);
    }
    if (temp !== undefined && temp > 35) {
      await History.create({
        event: 'High Temp Alert', userName: 'System',
        zoneName: zone || '—',
        details: `${deviceId}: temperature ${temp}°C`,
        type: 'danger',
      });
      socketService.emitSensorAlert(deviceId, 'high_temp', `${deviceId}: temperature ${temp}°C`);
    }
    if (waterLevel !== undefined && waterLevel < 20) {
      await History.create({
        event: 'Low Water Level Alert', userName: 'System',
        zoneName: zone || '—',
        details: `${deviceId}: water level at ${waterLevel}%`,
        type: 'warning',
      });
      socketService.emitSensorAlert(deviceId, 'low_water', `${deviceId}: water level at ${waterLevel}%`);
    }
    if (ph !== undefined && (ph < 5.5 || ph > 7.5)) {
      await History.create({
        event: 'pH Out of Range Alert', userName: 'System',
        zoneName: zone || '—',
        details: `${deviceId}: pH reading ${ph} (normal: 5.5–7.5)`,
        type: 'warning',
      });
      socketService.emitSensorAlert(deviceId, 'abnormal_ph', `${deviceId}: pH ${ph} (normal 5.5–7.5)`);
    }
    if (sirenActive) {
      await History.create({
        event: 'Siren Activated', userName: 'System',
        zoneName: zone || '—',
        details: `${deviceId}: siren triggered by device`,
        type: 'danger',
      });
      socketService.emitSensorAlert(deviceId, 'siren_active', `${deviceId}: siren triggered`);
    }

    return res.json({ message: 'OK', deviceId, timestamp: now });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── POST /api/sensors/:id/irrigate — queue a command for the device ───────────
// Called by frontend when toggling irrigation; ESP8266 picks it up via /command

router.post('/:id/irrigate', authenticate, authorize('owner', 'admin'), async (req, res) => {
  try {
    const { action, zoneId } = req.body;
    if (!['start', 'stop'].includes(action))
      return res.status(400).json({ message: 'action must be start or stop.' });

    const command  = action === 'start' ? 'irrigate_on' : 'irrigate_off';
    const deviceId = req.params.id.toUpperCase();

    await Sensor.updateOne(
      { deviceId },
      { $set: { pendingCommand: command, commandZoneId: zoneId || '' } }
    );

    // Push command instantly to device via Socket.IO if it is connected
    const deviceNs = socketService.getDeviceNs();
    if (deviceNs) {
      deviceNs.to(`device:${deviceId}`).emit('device:command', {
        command, zoneId: zoneId || '', lcdMessage: '',
      });
    }

    return res.json({ message: 'Command queued.', deviceId, command });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── POST /api/sensors/:id/siren — toggle siren on/off ────────────────────────
// Frontend sends { action: 'on' | 'off' }; device picks it up via /command

router.post('/:id/siren', authenticate, authorize('owner', 'admin'), async (req, res) => {
  try {
    const { action } = req.body;
    if (!['on', 'off'].includes(action))
      return res.status(400).json({ message: 'action must be on or off.' });

    const command  = action === 'on' ? 'siren_on' : 'siren_off';
    const deviceId = req.params.id.toUpperCase();

    await Sensor.updateOne(
      { deviceId },
      { $set: { pendingCommand: command, commandZoneId: '' } }
    );

    // Push instantly to device if connected via Socket.IO
    const deviceNs = socketService.getDeviceNs();
    if (deviceNs) {
      deviceNs.to(`device:${deviceId}`).emit('device:command', {
        command, zoneId: '', lcdMessage: '',
      });
    }

    return res.json({ message: 'Siren command queued.', deviceId, command });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── POST /api/sensors/:id/lcd — send message to LCD display ──────────────────
// Frontend sends { message: 'Hello Farm!' }; device picks it up via /command

router.post('/:id/lcd', authenticate, authorize('owner', 'admin'), async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string')
      return res.status(400).json({ message: 'message string is required.' });

    const deviceId = req.params.id.toUpperCase();
    const text     = message.substring(0, 64);

    await Sensor.updateOne(
      { deviceId },
      { $set: { pendingCommand: 'lcd_message', commandZoneId: text } }
    );

    // Push instantly to device if connected via Socket.IO
    const deviceNs = socketService.getDeviceNs();
    if (deviceNs) {
      deviceNs.to(`device:${deviceId}`).emit('device:command', {
        command: 'lcd_message', zoneId: '', lcdMessage: text,
      });
    }

    return res.json({ message: 'LCD command queued.', deviceId });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── PUT /api/sensors/:id/thresholds — update alert thresholds ────────────────
router.put('/:id/thresholds', authenticate, authorize('owner', 'admin'), [
  body('moistureMin').optional().isFloat({ min: 0,   max: 100  }),
  body('moistureMax').optional().isFloat({ min: 0,   max: 100  }),
  body('tempMax').    optional().isFloat({ min: 0,   max: 100  }),
  body('humidityMin').optional().isFloat({ min: 0,   max: 100  }),
  body('waterLevelMin').optional().isFloat({ min: 0, max: 100  }),
  body('phMin').      optional().isFloat({ min: 0,   max: 14   }),
  body('phMax').      optional().isFloat({ min: 0,   max: 14   }),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const allowed  = ['moistureMin','moistureMax','tempMax','humidityMin','waterLevelMin','phMin','phMax'];
    const update   = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) update[`thresholds.${k}`] = req.body[k]; });

    if (Object.keys(update).length === 0)
      return res.status(400).json({ message: 'No valid threshold fields provided.' });

    const sensor = await Sensor.findOneAndUpdate(
      { deviceId: req.params.id.toUpperCase() },
      { $set: update },
      { new: true }
    );
    if (!sensor) return res.status(404).json({ message: 'Sensor not found.' });

    return res.json({ message: 'Thresholds updated.', thresholds: sensor.thresholds });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── POST /api/sensors — admin registers a device manually ────────────────────

router.post('/', authenticate, authorize('owner', 'admin'), [
  body('macAddress')
    .trim()
    .notEmpty().withMessage('MAC address is required.')
    .matches(/^([0-9A-Fa-f]{2}[:\-]){5}[0-9A-Fa-f]{2}$/).withMessage('Invalid MAC address format. Use XX:XX:XX:XX:XX:XX'),
  body('type')
    .isIn(['Arduino Uno', 'ESP8266', 'Soil Sensor', 'Temp/Humidity', 'Water Level', 'pH Sensor', 'Relay Module', 'Unknown'])
    .withMessage('Invalid device type.'),
  body('name').optional().isString().isLength({ max: 60 }),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const { macAddress, type, zone, name } = req.body;
    const mac      = macAddress.toUpperCase().trim();
    const deviceId = 'ESP-' + mac.replace(/[:\-]/g, '').slice(-6);

    const existing = await Sensor.findOne({ macAddress: mac }).lean();
    if (existing)
      return res.status(409).json({ message: `Device with MAC ${mac} is already registered as ${existing.deviceId}.` });

    const sensor = await Sensor.findOneAndUpdate(
      { deviceId },
      { $setOnInsert: { deviceId, macAddress: mac, type, zoneName: zone || '', name: name || '' } },
      { upsert: true, new: true }
    );
    return res.status(201).json({ message: 'Device registered.', deviceId: sensor.deviceId, macAddress: mac });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/sensors/:id — update device name / zone / type ────────────────
router.patch('/:id', authenticate, authorize('owner', 'admin'), async (req, res) => {
  try {
    const allowed = ['name', 'type', 'zoneName', 'zone'];
    const set = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) set[k] = req.body[k]; });
    if (Object.keys(set).length === 0)
      return res.status(400).json({ message: 'No valid fields provided.' });

    const sensor = await Sensor.findOneAndUpdate(
      { deviceId: req.params.id.toUpperCase() },
      { $set: set },
      { new: true }
    );
    if (!sensor) return res.status(404).json({ message: 'Sensor not found.' });
    return res.json({ message: 'Device updated.', deviceId: sensor.deviceId });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── DELETE /api/sensors/:id ───────────────────────────────────────────────────

router.delete('/:id', authenticate, authorize('owner', 'admin'), async (req, res) => {
  try {
    await Sensor.findOneAndDelete({ deviceId: req.params.id.toUpperCase() });
    return res.status(204).end();
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// Background: mark sensors offline after 60 s of silence
setInterval(async () => {
  try {
    const cutoff = new Date(Date.now() - 60_000);
    const stale  = await Sensor.find({ online: true, lastSeen: { $lt: cutoff } }).lean();
    if (stale.length > 0) {
      await Sensor.updateMany(
        { online: true, lastSeen: { $lt: cutoff } },
        { $set: { online: false } }
      );
      // Notify frontend in real-time
      stale.forEach(s => socketService.emitSensorOffline(s.deviceId, s.lastSeen));
    }
  } catch (_) {}
}, 15_000);

module.exports = router;
