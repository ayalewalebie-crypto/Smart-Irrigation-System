const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  userId:             { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  timezone:           { type: String, default: 'Africa/Addis_Ababa' },
  units:              { type: String, enum: ['metric', 'imperial'], default: 'metric' },
  emailAlerts:        { type: Boolean, default: true },
  smsAlerts:          { type: Boolean, default: false },
  moistureThreshold:  { type: Number, default: 30 },
  tempThreshold:      { type: Number, default: 35 },
  autoIrrigate:       { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);
