const mongoose = require('mongoose');

const zoneSchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true },
  crop:      { type: String, default: '' },
  area:      { type: Number, default: 1.0 },
  active:    { type: Boolean, default: false },
  duration:  { type: Number, default: 15 },   // minutes
  schedule:  { type: String, default: '06:00' },
}, { timestamps: true });

zoneSchema.virtual('id').get(function () { return this._id.toHexString(); });
zoneSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Zone', zoneSchema);
