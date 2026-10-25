/**
 * User Management Route — 4-Role RBAC
 *
 * Authority hierarchy: owner > admin > office_manager > labor
 *
 * Permissions:
 *  - owner       : full access — list all, create, update, delete, approve/reject/suspend/deactivate any user
 *                  EXCEPT: cannot delete/deactivate/change-role of another owner
 *  - admin       : list & view users below them (office_manager, labor)
 *                  update permitted fields for office_manager & labor
 *                  approve/reject/suspend labor registrations (if owner grants permission)
 *                  cannot manage other admins or owner
 *  - office_manager / labor : no access to this route
 *
 * GET    /api/users               — owner, admin
 * GET    /api/users/pending        — owner, admin
 * GET    /api/users/:id            — owner, admin
 * POST   /api/users                — owner only
 * PUT    /api/users/:id            — owner, admin (restricted)
 * DELETE /api/users/:id            — owner only
 * PATCH  /api/users/:id/approve    — owner, admin (admin: labor only)
 * PATCH  /api/users/:id/reject     — owner, admin (admin: labor only)
 * PATCH  /api/users/:id/suspend    — owner only
 * PATCH  /api/users/:id/activate   — owner only
 * PATCH  /api/users/:id/deactivate — owner only
 * PATCH  /api/users/:id/role       — owner only
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const User     = require('../models/User');
const Settings = require('../models/Settings');
const History  = require('../models/History');
const { authenticate, requirePasswordChange, authorize } = require('../middleware/auth');
const { sendApprovalEmail, sendRejectionEmail } = require('../utils/email');
const {
  createEmployeeForUser,
  syncEmployeeRole,
  deleteEmployeeForUser,
} = require('../utils/employeeHelper');

const router = express.Router();

const PW_REGEX   = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;
const NAME_REGEX = /^[a-zA-Z\u1200-\u137F\s'\-]+$/;

// Role rank — higher number = higher authority
const ROLE_RANK = { owner: 4, admin: 3, office_manager: 2, labor: 1 };

function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ message: errors.array().map(e => e.msg).join(' | ') });
    return false;
  }
  return true;
}

// All routes: authenticated + not in forced-password-change
router.use(authenticate, requirePasswordChange, authorize('owner', 'admin'));

// ── GET /api/users ─────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { status, role, search } = req.query;

    const filter = {};

    // Admin can only see users strictly below them (office_manager, labor)
    if (req.user.role === 'admin') {
      filter.role = { $in: ['office_manager', 'labor'] };
    }

    if (status) filter.accountStatus = status;
    if (role && req.user.role === 'owner') filter.role = role;

    const users = await User.find(filter)
      .select('-password -__v')
      .sort({ createdAt: -1 })
      .lean();

    let result = users.map(u => ({ ...u, id: u._id }));

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(u =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
      );
    }

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── GET /api/users/pending ─────────────────────────────────────────────────────
router.get('/pending', async (req, res) => {
  try {
    const filter = { accountStatus: { $in: ['pending', 'rejected'] } };
    if (req.user.role === 'admin') {
      filter.role = { $in: ['office_manager', 'labor'] };
    }
    const users = await User.find(filter)
      .select('-password -__v')
      .sort({ createdAt: -1 })
      .lean();
    return res.json(users.map(u => ({ ...u, id: u._id })));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── GET /api/users/:id ─────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password -__v').lean();
    if (!user) return res.status(404).json({ message: 'User not found.' });

    // Admin cannot view owner or other admins
    if (req.user.role === 'admin' && ['owner', 'admin'].includes(user.role)) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    return res.json({ ...user, id: user._id });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── POST /api/users — owner only ───────────────────────────────────────────────
// Create a user account directly (not via employee flow).
// Created users get accountStatus: 'active' and mustChangePassword: true.
router.post('/', authorize('owner'), [
  body('name').trim().notEmpty().withMessage('Name is required.')
    .matches(NAME_REGEX).withMessage('Name must contain letters only.'),
  body('email').trim().normalizeEmail().isEmail().withMessage('Valid email is required.'),
  body('password').matches(PW_REGEX).withMessage('Password must be ≥8 chars with uppercase, lowercase, number and special character.'),
  body('role').isIn(['admin', 'office_manager', 'labor']).withMessage('Role must be admin, office_manager, or labor. Use /register for owner.'),
  body('phone').optional({ checkFalsy: true }).trim().isLength({ max: 20 }),
  body('farmName').optional({ checkFalsy: true }).trim().isLength({ max: 80 }),
  body('location').optional({ checkFalsy: true }).trim().isLength({ max: 80 }),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const { name, email, password, role, phone, farmName, location } = req.body;

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ message: 'Email is already registered.' });

    const user = await User.create({
      name:                name.trim(),
      email,
      password,
      role,
      phone:               (phone    || '').trim(),
      farmName:            (farmName || '').trim(),
      location:            (location || '').trim(),
      accountStatus:       'active',      // owner-created accounts are active immediately
      mustChangePassword:  true,          // force password change on first login
      isTemporaryPassword: true,
    });

    await Settings.create({ userId: user._id }).catch(() => {});

    // Auto-create Employee record for non-owner roles
    createEmployeeForUser(user, { createdBy: req.user.id })
      .catch(err => console.error('[EMPLOYEE] Auto-create failed on user create:', err.message));

    await History.create({
      event:    'User Created by Owner',
      userName: req.user.name,
      details:  `Owner created ${role} account for "${name}" — temporary password set`,
      type:     'success',
    }).catch(() => {});

    return res.status(201).json({
      message: 'User created. They must change their temporary password on first login.',
      id:      user._id,
      name:    user.name,
      role:    user.role,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── PUT /api/users/:id ─────────────────────────────────────────────────────────
router.put('/:id', [
  body('name').optional().trim().matches(NAME_REGEX).withMessage('Name must contain letters only.'),
  body('email').optional().trim().normalizeEmail().isEmail().withMessage('Valid email is required.'),
  body('phone').optional({ checkFalsy: true }).trim().isLength({ max: 20 }),
  body('accountNumber').optional({ checkFalsy: true }).trim().isLength({ max: 50 }),
  body('farmName').optional({ checkFalsy: true }).trim().isLength({ max: 80 }),
  body('location').optional({ checkFalsy: true }).trim().isLength({ max: 80 }),
  body('password').optional({ checkFalsy: true })
    .matches(PW_REGEX).withMessage('Password must be ≥8 chars with uppercase, lowercase, number and special character.'),
  body('adminNotes').optional({ checkFalsy: true }).trim().isLength({ max: 500 }),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const isSelf = String(req.params.id) === String(req.user.id);
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'User not found.' });

    // Users cannot change their own role
    if (isSelf && req.body.role !== undefined)
      return res.status(400).json({ message: 'You cannot change your own role.' });

    // Role rank check: actor must outrank target
    if (!isSelf && ROLE_RANK[req.user.role] <= ROLE_RANK[target.role]) {
      return res.status(403).json({ message: 'You cannot edit a user with equal or higher authority.' });
    }

    // Admin can only edit office_manager and labor
    if (req.user.role === 'admin' && !['office_manager', 'labor'].includes(target.role)) {
      return res.status(403).json({ message: 'Admin can only edit Office Manager or Laborer accounts.' });
    }

    const { name, email, phone, farmName, location, accountNumber, adminNotes } = req.body;
    if (name          !== undefined) target.name          = name.trim();
    if (email         !== undefined) target.email         = email;
    if (phone         !== undefined) target.phone         = phone.trim();
    if (farmName      !== undefined) target.farmName      = farmName.trim();
    if (location      !== undefined) target.location      = location.trim();
    if (accountNumber !== undefined) target.accountNumber = accountNumber.trim();
    if (adminNotes    !== undefined) target.adminNotes    = adminNotes.trim();

    // Only Owner can change/reset a password — Admin cannot
    if (req.body.password) {
      if (req.user.role !== 'owner') {
        return res.status(403).json({ message: 'Only the Owner can reset a user password.' });
      }
      target.password            = req.body.password;
      target.mustChangePassword  = true;
      target.isTemporaryPassword = true;
    }

    await target.save();

    await History.create({
      event:    'User Updated',
      userName: req.user.name,
      details:  `${req.user.role} updated account for "${target.name}"`,
      type:     'info',
    }).catch(() => {});

    return res.json({ message: 'User updated.', id: target._id, name: target.name, role: target.role });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/users/:id/approve ───────────────────────────────────────────────
// Owner: approve any pending user
// Admin: approve pending office_manager and labor only
router.patch('/:id/approve', async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'User not found.' });

    if (target.accountStatus !== 'pending')
      return res.status(400).json({ message: 'User is not in pending state.' });

    // Admin cannot approve admin or owner
    if (req.user.role === 'admin' && ['owner', 'admin'].includes(target.role))
      return res.status(403).json({ message: 'Admin cannot approve this role.' });

    target.accountStatus   = 'active';
    target.approvedBy      = req.user.id;
    target.approvedAt      = new Date();
    target.rejectionReason = '';
    await target.save();

    // Auto-create Employee record for non-owner roles (idempotent — safe if already exists)
    createEmployeeForUser(target, { createdBy: req.user.id })
      .catch(err => console.error('[EMPLOYEE] Auto-create failed on approve:', err.message));

    // Send approval email (non-blocking — don't fail the request if email fails)
    sendApprovalEmail({
      to:       target.email,
      name:     target.name,
      role:     target.role,
      loginUrl: `${process.env.APP_URL || 'http://localhost:5173'}/login`,
    }).catch(err => console.error('[EMAIL] Approval email failed:', err.message));

    await History.create({
      event:    'User Approved',
      userName: req.user.name,
      details:  `${req.user.role} approved registration for "${target.name}" (${target.role})`,
      type:     'success',
    }).catch(() => {});

    return res.json({ message: `${target.name}'s account has been approved.` });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/users/:id/reject ────────────────────────────────────────────────
router.patch('/:id/reject', [
  body('reason').optional({ checkFalsy: true }).trim().isLength({ max: 300 }),
], async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'User not found.' });

    if (target.accountStatus !== 'pending')
      return res.status(400).json({ message: 'User is not in pending state.' });

    if (req.user.role === 'admin' && ['owner', 'admin'].includes(target.role))
      return res.status(403).json({ message: 'Admin cannot reject this role.' });

    target.accountStatus   = 'rejected';
    target.rejectionReason = (req.body.reason || 'Registration rejected by administrator.').trim();
    await target.save();

    // Send rejection email (non-blocking)
    sendRejectionEmail({
      to:     target.email,
      name:   target.name,
      reason: target.rejectionReason,
    }).catch(err => console.error('[EMAIL] Rejection email failed:', err.message));

    await History.create({
      event:    'User Registration Rejected',
      userName: req.user.name,
      details:  `${req.user.role} rejected registration for "${target.name}" (${target.role}) — ${target.rejectionReason}`,
      type:     'warning',
    }).catch(() => {});

    return res.json({ message: `${target.name}'s registration has been rejected.` });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/users/:id/suspend — owner or admin ────────────────────────────
// Owner: can suspend any non-owner user
// Admin: can suspend office_manager and labor only
router.patch('/:id/suspend', async (req, res) => {
  try {
    if (String(req.params.id) === String(req.user.id))
      return res.status(400).json({ message: 'You cannot suspend your own account.' });

    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'User not found.' });
    if (target.role === 'owner')
      return res.status(403).json({ message: 'Owner accounts cannot be suspended.' });

    // Admin can only suspend office_manager and labor
    if (req.user.role === 'admin' && !['office_manager', 'labor'].includes(target.role))
      return res.status(403).json({ message: 'Admin can only suspend Office Manager or Laborer accounts.' });

    // Admin cannot suspend other admins
    if (req.user.role === 'admin' && target.role === 'admin')
      return res.status(403).json({ message: 'Admin cannot suspend another Admin.' });

    target.accountStatus = 'suspended';
    await target.save();

    await History.create({
      event:    'User Suspended',
      userName: req.user.name,
      details:  `${req.user.role} suspended account for "${target.name}" (${target.role})`,
      type:     'warning',
    }).catch(() => {});

    return res.json({ message: `${target.name}'s account has been suspended.` });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/users/:id/activate — owner or admin ───────────────────────────
// Owner: can activate any user
// Admin: can activate office_manager and labor only
router.patch('/:id/activate', async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'User not found.' });

    // Admin can only activate office_manager and labor
    if (req.user.role === 'admin' && !['office_manager', 'labor'].includes(target.role))
      return res.status(403).json({ message: 'Admin can only activate Office Manager or Laborer accounts.' });

    target.accountStatus = 'active';
    await target.save();

    await History.create({
      event:    'User Activated',
      userName: req.user.name,
      details:  `${req.user.role} re-activated account for "${target.name}" (${target.role})`,
      type:     'success',
    }).catch(() => {});

    return res.json({ message: `${target.name}'s account has been activated.` });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/users/:id/deactivate — owner or admin ─────────────────────────
// Owner: can deactivate any non-owner user
// Admin: can deactivate office_manager and labor only
router.patch('/:id/deactivate', async (req, res) => {
  try {
    if (String(req.params.id) === String(req.user.id))
      return res.status(400).json({ message: 'You cannot deactivate your own account.' });

    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'User not found.' });
    if (target.role === 'owner')
      return res.status(403).json({ message: 'Owner accounts cannot be deactivated by this endpoint.' });

    // Admin can only deactivate office_manager and labor
    if (req.user.role === 'admin' && !['office_manager', 'labor'].includes(target.role))
      return res.status(403).json({ message: 'Admin can only deactivate Office Manager or Laborer accounts.' });

    target.accountStatus = 'deactivated';
    await target.save();

    await History.create({
      event:    'User Deactivated',
      userName: req.user.name,
      details:  `${req.user.role} deactivated account for "${target.name}" (${target.role})`,
      type:     'warning',
    }).catch(() => {});

    return res.json({ message: `${target.name}'s account has been deactivated.` });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/users/:id/role — owner only ─────────────────────────────────────
router.patch('/:id/role', authorize('owner'), [
  body('role').isIn(['admin', 'office_manager', 'labor']).withMessage('Role must be admin, office_manager, or labor.'),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    if (String(req.params.id) === String(req.user.id))
      return res.status(400).json({ message: 'You cannot change your own role.' });

    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'User not found.' });
    if (target.role === 'owner')
      return res.status(403).json({ message: 'Owner role cannot be changed.' });

    const oldRole    = target.role;
    target.role      = req.body.role;
    await target.save();

    // Sync Employee record to the new role (creates one if missing, deletes if new role is owner)
    syncEmployeeRole(target._id, req.body.role)
      .catch(err => console.error('[EMPLOYEE] Role sync failed:', err.message));

    await History.create({
      event:    'User Role Changed',
      userName: req.user.name,
      details:  `Owner changed role for "${target.name}" from ${oldRole} to ${target.role}`,
      type:     'info',
    }).catch(() => {});

    return res.json({ message: `${target.name}'s role updated to ${target.role}.`, role: target.role });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── DELETE /api/users/:id — owner or admin ────────────────────────────────────
// Owner: can delete any non-owner user
// Admin: can delete office_manager and labor only
router.delete('/:id', async (req, res) => {
  try {
    if (String(req.params.id) === String(req.user.id))
      return res.status(400).json({ message: 'You cannot delete your own account.' });

    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'User not found.' });
    if (target.role === 'owner')
      return res.status(403).json({ message: 'Owner accounts cannot be deleted. Deactivate them instead.' });

    // Admin can only delete office_manager and labor
    if (req.user.role === 'admin' && !['office_manager', 'labor'].includes(target.role))
      return res.status(403).json({ message: 'Admin can only delete Office Manager or Laborer accounts.' });

    await User.findByIdAndDelete(req.params.id);

    // Also remove the linked Employee record if one exists
    deleteEmployeeForUser(req.params.id)
      .catch(err => console.error('[EMPLOYEE] Delete failed on user delete:', err.message));

    await History.create({
      event:    'User Deleted',
      userName: req.user.name,
      details:  `${req.user.role} removed ${target.role} account: "${target.name}" (${target.email})`,
      type:     'warning',
    }).catch(() => {});

    return res.status(204).end();
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
