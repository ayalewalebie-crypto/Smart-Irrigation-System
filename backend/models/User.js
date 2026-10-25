const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const ROLES = ['owner', 'admin', 'office_manager', 'labor'];

const ROLE_RANK = { owner: 1, admin: 2, office_manager: 3, labor: 4 };

const userSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },

  role: {
    type:    String,
    enum:    ROLES,
    default: 'labor',
  },

  phone:    { type: String, default: '' },
  accountNumber: { type: String, default: '' },
  farmName: { type: String, default: '' },
  location: { type: String, default: '' },
  joined:   { type: String, default: () => new Date().toISOString().split('T')[0] },

  accountStatus: {
    type:    String,
    enum:    ['pending', 'active', 'suspended', 'deactivated', 'rejected'],
    default: 'pending',
  },

  // Legacy field kept for backward compatibility — derived from accountStatus
  isActive: { type: Boolean, default: false },

  lastLogin:   { type: Date,   default: null },
  lastLoginIp: { type: String, default: '' },

  // Temporary-password flow
  mustChangePassword:   { type: Boolean, default: false },
  isTemporaryPassword:  { type: Boolean, default: false },

  // Profile photo (base64 or URL)
  avatar: { type: String, default: '' },

  // Language preference
  lang: { type: String, enum: ['en', 'am'], default: 'en' },

  // Employee link
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },

  assignedZones: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Zone' }],

  // Department
  department: { type: String, default: '' },

  // Approval audit trail
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },

  // Rejection reason (if registration was rejected)
  rejectionReason: { type: String, default: '' },

  // Notes from admin/owner
  adminNotes: { type: String, default: '' },
}, { timestamps: true });

// ── Sync isActive from accountStatus ─────────────────────────────────────────
userSchema.pre('save', function (next) {
  this.isActive = this.accountStatus === 'active';
  next();
});

// ── Hash password before save ─────────────────────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// ── Compare password helper ───────────────────────────────────────────────────
userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

// ── Strip sensitive fields from JSON responses ────────────────────────────────
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  delete obj.lastLoginIp;
  obj.id = obj._id;
  delete obj._id;
  // Ensure employeeId is always present (null for owner)
  obj.employeeId = obj.employeeId || null;
  return obj;
};

// ── Static: check if actor can manage target ─────────────────────────────────
userSchema.statics.canManage = function (actorRole, targetRole) {
  return (ROLE_RANK[actorRole] || 0) > (ROLE_RANK[targetRole] || 0);
};

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES      = ROLES;
module.exports.ROLE_RANK  = ROLE_RANK;
