const mongoose = require('mongoose');

// One document per calendar day — upserted when irrigation runs
const waterUsageSchema = new mongoose.Schema({
  date:        { type: String, required: true, unique: true }, // "YYYY-MM-DD"
  waterLiters: { type: Number, default: 0 },
  avgMoisture: { type: Number, default: 0 },
  events:      { type: Number, default: 0 },
});

module.exports = mongoose.model('WaterUsage', waterUsageSchema);
