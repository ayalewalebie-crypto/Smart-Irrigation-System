/**
 * Employee Model — extended HR profile linked to User account
 * Stores job information, salary, contract, and assignments
 */
const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  employeeId:    { type: String, unique: true, sparse: true, trim: true }, // e.g. EMP-001
  name:          { type: String, required: true, trim: true },
  email:         { type: String, required: true, trim: true, lowercase: true },
  phone:         { type: String, default: '', trim: true },
  role:          { type: String, enum: ['office_manager','admin','labor'], required: true },
  department:    { type: String, default: '', trim: true },
  jobTitle:      { type: String, default: '', trim: true },
  employmentType:{ type: String, enum: ['permanent','contract','part_time','seasonal'], default: 'permanent' },
  startDate:     { type: Date, default: null },
  endDate:       { type: Date, default: null },
  isActive:      { type: Boolean, default: true },
  baseSalary:    { type: Number, default: 0 },      // ETB/month
  currency:      { type: String, default: 'ETB' },
  paymentMethod: { type: String, enum: ['chapa'], default: 'chapa' },
  bankName:      { type: String, default: '', trim: true },
  bankAccount:   { type: String, default: '', trim: true },
  assignedFarm:  { type: String, default: '', trim: true },
  assignedZone:  { type: mongoose.Schema.Types.ObjectId, ref: 'Zone', default: null },
  supervisorId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  emergencyContact: { name: String, phone: String, relation: String },
  notes: { type: String, default: '', maxlength: 500 },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

employeeSchema.virtual('id').get(function () { return this._id.toHexString(); });
employeeSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Employee', employeeSchema);
