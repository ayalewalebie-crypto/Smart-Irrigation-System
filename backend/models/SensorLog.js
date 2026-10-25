const mongoose = require('mongoose');

// Every push from a device gets a new log entry — used for charts & reports
const sensorLogSchema = new mongoose.Schema({
  deviceId:    { type: String,  required: true, index: true },
  zoneName:    { type: String,  default: '' },
  temp:        { type: Number,  default: 0 },
  humidity:    { type: Number,  default: 0 },
  moisture:    { type: Number,  default: 0 },
  flow:        { type: Number,  default: 0 },
  ph:          { type: Number,  default: 0 },
  light:       { type: Number,  default: 0 },
  pressure:    { type: Number,  default: 0 },
  // New hardware devices
  waterLevel:  { type: Number,  default: 0 },
  lcdMessage:  { type: String,  default: '' },
  sirenActive: { type: Boolean, default: false },
  recordedAt:  { type: Date,    default: Date.now },
}, { timestamps: false });

// TTL index — auto-delete logs older than 90 days
sensorLogSchema.index({ recordedAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

module.exports = mongoose.model('SensorLog', sensorLogSchema);
