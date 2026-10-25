const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, default: '', maxlength: 500 },
  instructions:{ type: String, default: '', maxlength: 800 }, // detailed field instructions

  // Who it's assigned to (laborer user id + name for display)
  assignedTo:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedToName: { type: String, default: '' },

  // Who created it (admin/farmer/office_manager/owner)
  assignedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedByName: { type: String, default: '' },
  assignedByRole: { type: String, default: '' },

  zone:     { type: String, default: '' },
  category: { type: String, enum: ['irrigation','crop_care','maintenance','inspection','harvest','transport','office','other'], default: 'other' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  status:   { type: String, enum: ['pending', 'in_progress', 'completed', 'reviewed', 'unable_to_complete', 'overdue'], default: 'pending' },
  dueDate:  { type: Date, default: null },

  // Completion evidence — laborer can add notes and file references
  report:       { type: String, default: '', maxlength: 1000 },
  evidenceUrls: [{ type: String }],    // uploaded photo/document URLs
  completedAt:  { type: Date, default: null },

  // Problem report (laborer reports issues)
  problemReport: { type: String, default: '', maxlength: 800 },
  problemType:   { type: String, enum: ['equipment','sensor','power','crop','water','other',''], default: '' },

  // Verification by farmer/admin
  verifiedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  verifiedByName: { type: String, default: '' },
  verifiedAt:     { type: Date, default: null },
  verificationNote: { type: String, default: '' },

  isOverdue: { type: Boolean, default: false },
}, { timestamps: true });

// Auto-mark overdue on save — never marks completed/reviewed tasks
taskSchema.pre('save', function (next) {
  const terminalStatuses = ['completed', 'unable_to_complete', 'reviewed'];

  if (terminalStatuses.includes(this.status)) {
    // Completed tasks are never overdue
    this.isOverdue = false;
    next();
    return;
  }

  if (this.dueDate) {
    this.isOverdue = new Date() > new Date(this.dueDate);
    if (this.isOverdue && this.status !== 'overdue') {
      this.status = 'overdue';
    }
  }
  next();
});

taskSchema.virtual('id').get(function () { return this._id.toHexString(); });
taskSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Task', taskSchema);
