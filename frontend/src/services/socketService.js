/**
 * socketService.js  (frontend)
 *
 * Connects to the backend default Socket.IO namespace (/).
 * The ESP8266 connects to the /device namespace on the same server.
 *
 * Data flow:
 *   ESP8266  ──socket.emit('device:data',...)──►  backend /device namespace
 *                                                  │
 *                                                  ├── saves to MongoDB
 *                                                  ├── checks thresholds
 *                                                  └── io.emit('sensor:update') ──► here
 *
 * Events received from backend:
 *   sensor:update       { id, type, zone, online, lastSeen, temp, humidity,
 *                          moisture, flow, ph, light, pressure,
 *                          waterLevel, lcdMessage, sirenActive }
 *   sensor:offline      { id, online:false, lastSeen }
 *   sensor:alert        { id, type, message }
 *   device:connected    { id, type, zone }
 *   device:disconnected { id }
 *
 * Commands sent to backend (forwarded to device):
 *   send:command  { deviceId, command, payload }
 *     commands: 'irrigate_on' | 'irrigate_off' | 'siren_on' | 'siren_off' | 'lcd_message'
 */

import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'http://localhost:8000';

let socket = null;

// ── Connect / Disconnect ──────────────────────────────────────────────────────

function connect() {
  if (socket?.connected) return socket;

  socket = io(SOCKET_URL, {
    // default namespace  /
    transports: ['websocket', 'polling'],
    reconnection:          true,
    reconnectionAttempts:  Infinity,
    reconnectionDelay:     1000,
    reconnectionDelayMax:  10000,
    timeout:               10000,
  });

  socket.on('connect', () => {
    console.log('[Socket.IO] Frontend connected :', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.warn('[Socket.IO] Disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.warn('[Socket.IO] Connection error:', err.message);
  });

  return socket;
}

function disconnect() {
  if (socket) { socket.disconnect(); socket = null; }
}

function isConnected() {
  return socket?.connected ?? false;
}

// ── Subscribe helpers — each returns an unsubscribe function ──────────────────

function onSensorUpdate(callback) {
  if (!socket) connect();
  socket.on('sensor:update', callback);
  return () => socket?.off('sensor:update', callback);
}

function onSensorOffline(callback) {
  if (!socket) connect();
  socket.on('sensor:offline', callback);
  return () => socket?.off('sensor:offline', callback);
}

function onSensorAlert(callback) {
  if (!socket) connect();
  socket.on('sensor:alert', callback);
  return () => socket?.off('sensor:alert', callback);
}

/** Fires when an ESP8266 registers / reconnects */
function onDeviceConnected(callback) {
  if (!socket) connect();
  socket.on('device:connected', callback);
  return () => socket?.off('device:connected', callback);
}

/** Fires when an ESP8266 socket disconnects */
function onDeviceDisconnected(callback) {
  if (!socket) connect();
  socket.on('device:disconnected', callback);
  return () => socket?.off('device:disconnected', callback);
}

// ── Per-device rooms ──────────────────────────────────────────────────────────

function subscribeDevice(deviceId) {
  if (!socket) connect();
  socket.emit('subscribe:sensor', deviceId);
}

function unsubscribeDevice(deviceId) {
  socket?.emit('unsubscribe:sensor', deviceId);
}

// ── Send command to device via backend ───────────────────────────────────────
// The backend forwards it to the /device namespace room for that deviceId.

function sendCommand(deviceId, command, payload = '') {
  if (!socket) connect();
  socket.emit('send:command', { deviceId, command, payload });
}

export default {
  connect,
  disconnect,
  isConnected,
  onSensorUpdate,
  onSensorOffline,
  onSensorAlert,
  onDeviceConnected,
  onDeviceDisconnected,
  subscribeDevice,
  unsubscribeDevice,
  sendCommand,
};
