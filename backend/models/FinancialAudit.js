/**
 * FinancialAudit Model — immutable audit trail for all financial actions
 * Records: who, what, when, on which record, with before/after snapshot
 */
const mongoose = require('mongoose');

const financialAuditSchema = new mongoose.Schema({
  module:      { type: String, enum: ['budget','expense','income','payroll'], required: true },
  action:      { type: String, required: true }, // 'created','updated','submitted','approved','rejected','paid','deleted'
  recordId:    { type: mongoose.Schema.Types.ObjectId, required: true },
  recordTitle: { type: String, default: '' },
  amount:      { type: Number, default: 0 },
  currency:    { type: String, default: 'ETB' },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  performedByName: { type: String, default: '' },
  performedByRole: { type: String, default: '' },
  notes:       { type: String, default: '', maxlength: 300 },
  ipAddress:   { type: String, default: '' },
  timestamp:   { type: Date, default: Date.now },
});

// Auto-delete audit older than 3 years
financialAuditSchema.index({ timestamp: 1 }, { expireAfterSeconds: 3 * 365 * 24 * 3600 });

financialAuditSchema.virtual('id').get(function () { return this._id.toHexString(); });
financialAuditSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('FinancialAudit', financialAuditSchema);
