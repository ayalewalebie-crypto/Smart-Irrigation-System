/**
 * ProblemReport Model — farm/irrigation problems reported by laborers
 */
const mongoose = require('mongoose');

const problemReportSchema = new mongoose.Schema({
  reportedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reportedByName: { type: String, default: '' },

  problemType: {
    type: String,
    enum: ['pump','pipe_leakage','low_water','sensor','irrigation_not_working','equipment','crop','power','other'],
    required: true,
  },
  farm:        { type: String, default: '', trim: true },   // farm / zone name
  field:       { type: String, default: '', trim: true },   // specific field
  description: { type: String, required: true, trim: true, maxlength: 1000 },
  priority:    { type: String, enum: ['low','medium','high','urgent'], default: 'medium' },

  status: {
    type:    String,
    enum:    ['open','in_review','resolved'],
    default: 'open',
  },

  // Optional image URL (base64 stored as string or file path)
  imageUrl:  { type: String, default: '' },

  // Resolution info
  resolvedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolvedByName: { type: String, default: '' },
  resolvedAt:   { type: Date, default: null },
  resolution:   { type: String, default: '', maxlength: 500 },

  // Optional link to a task
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },

}, { timestamps: true });

problemReportSchema.virtual('id').get(function () { return this._id.toHexString(); });
problemReportSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('ProblemReport', problemReportSchema);
