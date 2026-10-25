/**
 * Expense Model — individual expense records in ETB
 * Approval workflow: draft → submitted → approved → paid | rejected
 * Large expenses (> threshold) require Owner approval
 */
const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true, maxlength: 150 },
  description: { type: String, default: '', maxlength: 500 },
  category:    {
    type: String,
    enum: ['salaries','seeds','fertilizer','irrigation','fuel','equipment','maintenance','transport','farm_operations','office','other'],
    required: true,
  },

  amount:    { type: Number, required: true, min: 0 },
  currency:  { type: String, default: 'ETB' },
  expenseDate: { type: Date, required: true },

  budgetId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Budget', default: null },
  budgetCategory: { type: String, default: '' },

  // Receipt / supporting document
  receiptUrl:  { type: String, default: '' },
  receiptRef:  { type: String, default: '' },  // reference number

  // Vendor info
  vendor:      { type: String, default: '', trim: true },
  invoiceNo:   { type: String, default: '', trim: true },

  // Approval workflow
  status: {
    type: String,
    enum: ['draft','submitted','approved','paid','rejected'],
    default: 'draft'
  },
  requiresOwnerApproval: { type: Boolean, default: false }, // auto-set when amount > threshold
  rejectionReason: { type: String, default: '' },
  notes: { type: String, default: '', maxlength: 500 },

  // Audit trail
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdByName: { type: String, default: '' },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  submittedAt: { type: Date, default: null },
  approvedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedByName: { type: String, default: '' },
  approvedAt:  { type: Date, default: null },
  paidBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  paidAt:      { type: Date, default: null },
  paymentRef:  { type: String, default: '' },
}, { timestamps: true });

expenseSchema.virtual('id').get(function () { return this._id.toHexString(); });
expenseSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Expense', expenseSchema);
