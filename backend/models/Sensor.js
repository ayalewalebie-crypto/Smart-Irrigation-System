const mongoose = require('mongoose');

const readingSchema = new mongoose.Schema({
  temp:        { type: Number,  default: 0 },
  humidity:    { type: Number,  default: 0 },
  moisture:    { type: Number,  default: 0 },
  flow:        { type: Number,  default: 0 },
  ph:          { type: Number,  default: 0 },
  light:       { type: Number,  default: 0 },
  pressure:    { type: Number,  default: 0 },
  waterLevel:  { type: Number,  default: 0 },   // 0–100 %
  lcdMessage:  { type: String,  default: '' },
  sirenActive: { type: Boolean, default: false },
  updatedAt:   { type: Date,    default: Date.now },
}, { _id: false });

const alertThresholdSchema = new mongoose.Schema({
  moistureMin:   { type: Number, default: 20 },  // auto-irrigate below this
  moistureMax:   { type: Number, default: 80 },
  tempMax:       { type: Number, default: 40 },
  humidityMin:   { type: Number, default: 20 },
  waterLevelMin: { type: Number, default: 15 },  // pump locked below this
  phMin:         { type: Number, default: 5.5 },
  phMax:         { type: Number, default: 7.5 },
}, { _id: false });

const sensorSchema = new mongoose.Schema({
  deviceId:       { type: String, required: true, unique: true, uppercase: true, trim: true },
  macAddress:     { type: String, default: '', trim: true, uppercase: true },
  name:           { type: String, default: '' },
  type:           { type: String, enum: ['Arduino Uno', 'ESP8266', 'Soil Sensor', 'Temp/Humidity', 'Water Level', 'pH Sensor', 'Relay Module', 'Unknown'], default: 'Unknown' },
  zone:           { type: mongoose.Schema.Types.ObjectId, ref: 'Zone', default: null },
  zoneName:       { type: String, default: '' },

  // Connection status
  online:         { type: Boolean, default: false },
  lastSeen:       { type: Date, default: null },
  connectionStatus: { type: String, enum: ['online','offline','fault'], default: 'offline' },

  // Device health
  batteryLevel:   { type: Number, default: null },     // null = wired, 0-100 for battery
  firmwareVersion:{ type: String, default: '' },
  signalStrength: { type: Number, default: 0 },        // dBm for WiFi signal

  // Pump / relay state
  pumpStatus:     { type: String, enum: ['on','off','fault'], default: 'off' },
  relayState:     { type: Boolean, default: false },
  autoIrrigate:   { type: Boolean, default: false },   // auto-mode enabled

  reading:        { type: readingSchema, default: () => ({}) },
  thresholds:     { type: alertThresholdSchema, default: () => ({}) },

  // Active alerts on this device
  alerts: [{
    type:    { type: String, enum: ['low_moisture','low_water','abnormal_ph','high_temp','sensor_fault','pump_fault','offline'] },
    message: { type: String },
    since:   { type: Date, default: Date.now },
    resolved:{ type: Boolean, default: false },
  }],

  // Command queued by frontend → picked up by ESP8266 on next poll
  pendingCommand: { type: String, default: 'none' },
  commandZoneId:  { type: String, default: '' },
}, { timestamps: true });

sensorSchema.virtual('id').get(function () { return this._id.toHexString(); });
sensorSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Sensor', sensorSchema);
