const express  = require('express');
const jwt      = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User     = require('../models/User');
const Settings = require('../models/Settings');
const History  = require('../models/History');
const { authenticate } = require('../middleware/auth');
require('dotenv').config();

const router = express.Router();

// ── Shared regex ──────────────────────────────────────────────────────────────
const PW_REGEX   = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;
const NAME_REGEX = /^[a-zA-Z\u1200-\u137F\s'\-]+$/;

// ── Validation helper ─────────────────────────────────────────────────────────
function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const msg = errors.array().map(e => e.msg).join(' | ');
    res.status(422).json({ message: msg });
    return false;
  }
  return true;
}

// ── JWT helper ────────────────────────────────────────────────────────────────
function signToken(user) {
  return jwt.sign(
    {
      id:                 user._id,
      name:               user.name,
      email:              user.email,
      role:               user.role,
      accountStatus:      user.accountStatus,
      employeeId:         user.employeeId || null,
      mustChangePassword: user.mustChangePassword || false,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// ── POST /api/auth/register ───────────────────────────────────────────────────
// Open self-registration for ALL roles. All accounts are immediately active.
//
// Security: users cannot self-assign the 'owner' role if an owner already
// exists. The very first registration is always treated as owner.
router.post('/register', [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required.')
    .matches(NAME_REGEX).withMessage('Name must contain letters only — no numbers or special characters.'),
  body('email')
    .trim().normalizeEmail()
    .isEmail().withMessage('A valid email address is required.'),
  body('password')
    .matches(PW_REGEX).withMessage('Password must be ≥8 chars and include uppercase, lowercase, a number and a special character.'),
  body('role')
    .optional()
    .isIn(['owner', 'admin', 'office_manager', 'labor'])
    .withMessage('Role must be one of: owner, admin, office_manager, labor.'),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const { name, email, password, phone, farmName, location } = req.body;
    let requestedRole = req.body.role || 'labor';

    // Check if any owner already exists
    const ownerExists = await User.findOne({ role: 'owner' }).lean();

    // If no owner exists yet, force this registration to be an owner
    if (!ownerExists) {
      requestedRole = 'owner';
    }

    // Prevent self-registration as owner when an owner already exists
    if (requestedRole === 'owner' && ownerExists) {
      return res.status(400).json({
        message: 'Owner accounts cannot be self-registered. Contact the existing Farm Owner.',
      });
    }

    // owner registrations require farmName + location
    if (requestedRole === 'owner') {
      if (!farmName || !farmName.trim())
        return res.status(400).json({ message: 'Farm name is required for Owner registration.' });
      if (!location || !location.trim())
        return res.status(400).json({ message: 'Location is required for Owner registration.' });
    }

    const exists = await User.findOne({ email });
    if (exists)
      return res.status(409).json({ message: 'Email is already registered.' });

    // Owner always gets active immediately (first user, no approval needed).
    // All other self-registered users start as pending and need admin approval.
    const accountStatus = requestedRole === 'owner' ? 'active' : 'pending';

    const user = await User.create({
      name:                name.trim(),
      email,
      password,
      role:                requestedRole,
      phone:               (phone    || '').trim().substring(0, 20),
      accountNumber:       (req.body.accountNumber || '').trim().substring(0, 50),
      farmName:            (farmName || '').trim().substring(0, 80),
      location:            (location || '').trim().substring(0, 80),
      accountStatus,
      mustChangePassword:  false,
      isTemporaryPassword: false,
    });

    // Create default settings for this user
    await Settings.create({ userId: user._id }).catch(() => {});

    await History.create({
      event:    requestedRole === 'owner' ? 'Owner Registered' : 'User Registered',
      userName: user.name,
      details:  `"${user.name}" registered as ${requestedRole}`,
      type:     'success',
    }).catch(() => {});

    const message = requestedRole === 'owner'
      ? 'Owner account created successfully. Please sign in.'
      : 'Registration submitted successfully. Your account is pending admin approval. You will be notified by email once approved.';

    return res.status(201).json({ message });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', [
  body('email').trim().normalizeEmail().isEmail().withMessage('Valid email is required.'),
  body('password').notEmpty().withMessage('Password is required.'),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(401).json({ message: 'Invalid email or password.' });

    const match = await user.comparePassword(password);
    if (!match)
      return res.status(401).json({ message: 'Invalid email or password.' });

    // Check account status — only 'active' users may receive a token
    if (user.accountStatus === 'pending') {
      return res.status(403).json({
        code:          'ACCOUNT_PENDING',
        message:       'Your account is waiting for admin approval.',
        accountStatus: 'pending',
      });
    }

    if (user.accountStatus === 'rejected') {
      return res.status(403).json({
        code:          'ACCOUNT_REJECTED',
        message:       'Your registration was not approved. Please contact the Farm Administrator.',
        accountStatus: 'rejected',
      });
    }

    if (user.accountStatus === 'suspended') {
      return res.status(403).json({
        code:    'ACCOUNT_SUSPENDED',
        message: 'Your account has been suspended. Please contact the Farm Owner.',
        accountStatus: 'suspended',
      });
    }

    if (user.accountStatus === 'deactivated' || !user.isActive) {
      return res.status(403).json({
        code:    'ACCOUNT_DEACTIVATED',
        message: 'Your account has been deactivated. Please contact the Farm Owner.',
        accountStatus: 'deactivated',
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    await History.create({
      event:    'User Login',
      userName: user.name,
      details:  `${user.name} signed in as ${user.role}${user.mustChangePassword ? ' (must change password)' : ''}`,
      type:     'info',
    }).catch(() => {});

    const token    = signToken(user);
    const safeUser = user.toSafeObject();

    return res.json({
      token,
      user:               safeUser,
      mustChangePassword: user.mustChangePassword || false,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -__v');
    if (!user) return res.status(404).json({ message: 'User not found.' });
    return res.json(user.toSafeObject());
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── PUT /api/auth/me ──────────────────────────────────────────────────────────
router.put('/me', authenticate, [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required.')
    .matches(NAME_REGEX).withMessage('Name must contain letters only.'),
  body('phone').optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 20 }).withMessage('Phone too long.'),
  body('farmName').optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 80 }).withMessage('Farm name too long.'),
  body('location').optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 80 }).withMessage('Location too long.'),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const { name, phone, farmName, location } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        name:     name.trim(),
        phone:    (phone    || '').trim(),
        farmName: (farmName || '').trim(),
        location: (location || '').trim(),
      },
      { new: true, runValidators: true }
    ).select('-password -__v');

    if (!user) return res.status(404).json({ message: 'User not found.' });
    return res.json(user.toSafeObject());
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── PUT /api/auth/me/password ─────────────────────────────────────────────────
router.put('/me/password', authenticate, [
  body('currentPassword').notEmpty().withMessage('Current password is required.'),
  body('newPassword')
    .matches(PW_REGEX).withMessage('New password must be ≥8 chars and include uppercase, lowercase, a number and a special character.'),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const match = await user.comparePassword(currentPassword);
    if (!match)
      return res.status(401).json({ message: 'Current password is incorrect.' });

    if (currentPassword === newPassword)
      return res.status(400).json({ message: 'New password must differ from current password.' });

    user.password            = newPassword;
    user.mustChangePassword  = false;
    user.isTemporaryPassword = false;
    await user.save();

    return res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── PUT /api/auth/me/force-change-password ────────────────────────────────────
router.put('/me/force-change-password', authenticate, [
  body('temporaryPassword').notEmpty().withMessage('Temporary password is required.'),
  body('newPassword')
    .matches(PW_REGEX).withMessage('New password must be ≥8 chars and include uppercase, lowercase, a number and a special character.'),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const { temporaryPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const match = await user.comparePassword(temporaryPassword);
    if (!match)
      return res.status(401).json({ message: 'Temporary password is incorrect.' });

    if (temporaryPassword === newPassword)
      return res.status(400).json({ message: 'New password must differ from your temporary password.' });

    user.password            = newPassword;
    user.mustChangePassword  = false;
    user.isTemporaryPassword = false;
    await user.save();

    await History.create({
      event:    'Password Changed',
      userName: user.name,
      details:  `${user.name} changed temporary password on first login`,
      type:     'success',
    }).catch(() => {});

    const newToken = signToken(user);
    return res.json({
      message: 'Password changed successfully. Welcome!',
      token:   newToken,
      user:    user.toSafeObject(),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
