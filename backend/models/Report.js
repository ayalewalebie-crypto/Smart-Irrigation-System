/**
 * Report Model — generated reports stored for quick access
 * Types: water, sensor, financial, payroll, attendance, crop, etc.
 */
const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true },
  type:        {
    type: String,
    enum: ['water','sensor','financial','payroll','attendance','expense','income','crop','task','custom'],
    required: true
  },
  format:      { type: String, enum: ['json','pdf','csv','excel'], default: 'json' },
  dateRange:   { from: Date, to: Date },
  parameters:  { type: mongoose.Schema.Types.Mixed, default: {} }, // filter params as JSON
  dataSnapshot:{ type: mongoose.Schema.Types.Mixed, default: {} }, // full report data
  summary:     { type: String, default: '', maxlength: 500 },
  fileUrl:     { type: String, default: '' }, // if exported to file
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  generatedByName: { type: String, default: '' },
  generatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Auto-delete old reports after 1 year
reportSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 3600 });

reportSchema.virtual('id').get(function () { return this._id.toHexString(); });
reportSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Report', reportSchema);
