/**
 * Payroll Model — monthly payroll record per employee
 * Supports full Ethiopian payroll: basic salary, allowances, overtime, deductions
 * Status flow: draft → submitted → approved → paid | rejected
 */
const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema({
  employeeId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  employeeName:  { type: String, default: '' },
  employeeRole:  { type: String, default: '' },
  department:    { type: String, default: '' },
  payPeriod:     { type: String, required: true }, // "YYYY-MM" e.g. "2024-01"
  month:         { type: Number, required: true },  // 1-12
  year:          { type: Number, required: true },

  // Earnings (ETB)
  baseSalary:      { type: Number, default: 0, min: 0 },
  overtimePay:     { type: Number, default: 0, min: 0 },
  bonus:           { type: Number, default: 0, min: 0 },
  allowance:       { type: Number, default: 0, min: 0 }, // transport, housing, etc.
  otherEarnings:   { type: Number, default: 0, min: 0 },

  // Deductions (ETB)
  incomeTax:       { type: Number, default: 0, min: 0 },
  pensionEmployee: { type: Number, default: 0, min: 0 }, // 7% in Ethiopia
  pensionEmployer: { type: Number, default: 0, min: 0 }, // 11% in Ethiopia
  unpaidDays:      { type: Number, default: 0, min: 0 }, // ETB amount
  otherDeductions: { type: Number, default: 0, min: 0 },

  // Summary
  grossSalary:  { type: Number, default: 0 },
  totalDeductions:{ type: Number, default: 0 },
  netSalary:    { type: Number, default: 0 },
  currency:     { type: String, default: 'ETB' },

  // Attendance summary for the month
  workingDays:  { type: Number, default: 0 },
  presentDays:  { type: Number, default: 0 },
  absentDays:   { type: Number, default: 0 },
  leaveDays:    { type: Number, default: 0 },
  overtimeHours:{ type: Number, default: 0 },

  // Workflow
  status: {
    type: String,
    enum: ['draft','submitted','approved','paid','rejected'],
    default: 'draft'
  },
  notes:       { type: String, default: '', maxlength: 500 },
  rejectionReason: { type: String, default: '' },

  // Audit trail
  createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  submittedAt: { type: Date, default: null },
  approvedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt:  { type: Date, default: null },
  paidBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  paidAt:      { type: Date, default: null },
  paymentRef:  { type: String, default: '' },
}, { timestamps: true });

// One payroll record per employee per month
payrollSchema.index({ employeeId: 1, payPeriod: 1 }, { unique: true });

payrollSchema.virtual('id').get(function () { return this._id.toHexString(); });
payrollSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Payroll', payrollSchema);
