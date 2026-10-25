/**
 * Attendance Model — daily attendance records per employee
 */
const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  employeeId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  employeeName: { type: String, default: '' },
  date:         { type: String, required: true }, // "YYYY-MM-DD"
  status:       { type: String, enum: ['present','absent','late','half_day','leave','holiday','overtime'], default: 'present' },
  checkIn:   { type: String, default: '' },  // "HH:MM"
  checkOut:  { type: String, default: '' },  // "HH:MM"
  workHours:    { type: Number, default: 0 },   // decimal hours
  overtimeHours:{ type: Number, default: 0 },
  lateMinutes:  { type: Number, default: 0 },
  leaveType:    { type: String, enum: ['annual','sick','emergency','unpaid','maternity','other',''], default: '' },
  notes:        { type: String, default: '', maxlength: 300 },
  recordedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  recordedAt:   { type: Date, default: Date.now },
}, { timestamps: true });

attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

attendanceSchema.virtual('id').get(function () { return this._id.toHexString(); });
attendanceSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
