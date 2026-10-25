const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
  event:      { type: String, required: true },
  userName:   { type: String, default: 'System' },
  zoneName:   { type: String, default: '—' },
  details:    { type: String, default: '' },
  type:       { type: String, enum: ['info', 'success', 'warning', 'danger'], default: 'info' },
  recordedAt: { type: Date, default: Date.now },
});

// Auto-delete history older than 1 year
historySchema.index({ recordedAt: 1 }, { expireAfterSeconds: 365 * 24 * 3600 });

module.exports = mongoose.model('History', historySchema);
