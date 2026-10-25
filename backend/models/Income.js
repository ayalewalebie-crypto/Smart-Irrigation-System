/**
 * Income Model — farm revenue records in ETB
 * Sources: crop sales, government grants, consulting, other farm income
 */
const mongoose = require('mongoose');

const incomeSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true, maxlength: 150 },
  description: { type: String, default: '', maxlength: 500 },
  source:      {
    type: String,
    enum: ['crop_sales','livestock','government_grant','consulting','donation','rent','other'],
    required: true
  },

  amount:    { type: Number, required: true, min: 0 },
  currency:  { type: String, default: 'ETB' },
  incomeDate:{ type: Date, required: true },

  // Crop sales details
  cropType:   { type: String, default: '', trim: true },
  quantity:   { type: Number, default: 0 },
  unit:       { type: String, default: '' }, // kg, quintals, bags, etc.

  // Customer / payer
  customer:   { type: String, default: '', trim: true },
  invoiceNo:  { type: String, default: '', trim: true },
  receiptRef: { type: String, default: '', trim: true },

  // Payment
  paymentMethod: { type: String, enum: ['cash','bank_transfer','cheque','mobile_money','other'], default: 'cash' },
  status:        { type: String, enum: ['pending','received','cancelled'], default: 'received' },
  notes:         { type: String, default: '', maxlength: 500 },

  // Audit
  recordedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recordedByName: { type: String, default: '' },
  recordedAt:   { type: Date, default: Date.now },
}, { timestamps: true });

incomeSchema.virtual('id').get(function () { return this._id.toHexString(); });
incomeSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Income', incomeSchema);
