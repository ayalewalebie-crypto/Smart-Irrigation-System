/**
 * Employee Profile Routes
 *
 * Business rules:
 *  - Owner only  : create employees (POST) — sets mustChangePassword on the linked User
 *  - Owner + Office Manager + Admin : view/list employees (GET), update HR fields (PUT), activate/deactivate (PATCH)
 *  - Admin sees only farmer / labor employees
 *  - Office Manager can manage existing employee info but CANNOT create new accounts
 *  - Owner only  : delete employee + linked User account (DELETE)
 *
 * GET    /api/employees          — owner / admin / office_manager
 * GET    /api/employees/me       — any authenticated user (own record)
 * GET    /api/employees/:id      — owner / admin / office_manager
 * POST   /api/employees          — owner only  (creates User + Employee with temp password)
 * PUT    /api/employees/:id      — owner / admin / office_manager  (HR fields only)
 * PATCH  /api/employees/:id/activate — owner / office_manager
 * DELETE /api/employees/:id      — owner only  (deletes Employee + User)
 */

const express   = require('express');
const mongoose  = require('mongoose');
const { body, validationResult } = require('express-validator');
const Employee  = require('../models/Employee');
const User      = require('../models/User');
const History   = require('../models/History');
const { authenticate, requirePasswordChange, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requirePasswordChange);

// Roles that can have employee profiles (owner is excluded — not an employee)
const EMPLOYEE_ROLES = ['admin', 'office_manager', 'labor'];

// Strong-password regex (same as frontend)
const PW_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\-_=+[\]{};':"\\|,.<>/?]).{8,}$/;

function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ message: errors.array().map(e => e.msg).join(' | ') });
    return false;
  }
  return true;
}

async function generateEmployeeId() {
  const count = await Employee.countDocuments();
  return `EMP-${String(count + 1).padStart(4, '0')}`;
}

// ── GET /api/employees/me ──────────────────────────────────────────────────────
router.get('/me', async (req, res) => {
  try {
    // Owner is an investor, not an employee — no employee profile exists for them
    if (req.user.role === 'owner') {
      return res.status(403).json({
        message: 'The Owner is not an employee. No employee profile exists for this account.',
      });
    }

    const emp = await Employee.findOne({ userId: req.user.id }).lean();
    if (!emp) return res.status(404).json({ message: 'Employee profile not found.' });

    // Mask bank account for laborer viewing own record
    if (req.user.role === 'labor') {
      return res.json({ ...emp, bankAccount: undefined });
    }
    return res.json(emp);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── GET /api/employees ─────────────────────────────────────────────────────────
router.get('/', authorize('owner', 'admin', 'office_manager'), async (req, res) => {
  try {
    const { role, isActive, department, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (department) filter.department = department;
    if (isActive !== undefined && isActive !== '') {
      filter.isActive = isActive === 'true';
    }

    // Owner is never an employee — always exclude 'owner' role from employee lists
    const EMPLOYEE_ROLES_ALLOWED = ['admin', 'office_manager', 'labor'];

    if (role && EMPLOYEE_ROLES_ALLOWED.includes(role)) {
      filter.role = role;
    } else {
      filter.role = { $in: EMPLOYEE_ROLES_ALLOWED };
    }

    // Admin can only see office_manager / labor employees
    if (req.user.role === 'admin') {
      filter.role = { $in: ['office_manager', 'labor'] };
    }

    // Office Manager sees only laborers (for attendance management)
    if (req.user.role === 'office_manager') {
      // If a specific allowed role was requested and it's not labor, return empty
      if (role && role !== 'labor') {
        return res.json({ employees: [], total: 0, page: 1, pages: 0 });
      }
      filter.role = 'labor';
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Populate userId to check User.accountStatus (only active/approved users)
    const [employeesRaw, total] = await Promise.all([
      Employee.find(filter)
        .populate({ path: 'userId', select: 'accountStatus' })
        .sort({ employeeId: 1 })  // Sort by EMP-001, EMP-002, etc.
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Employee.countDocuments(filter),
    ]);

    // Filter out employees whose User account is not 'active' (approved)
    const employees = employeesRaw.filter(e => e.userId?.accountStatus === 'active');

    const sanitized = employees.map(e => ({
      ...e,
      userId: e.userId?._id,  // Don't expose full User object
      bankAccount: req.user.role === 'admin' ? undefined : e.bankAccount,
    }));

    return res.json({
      employees: sanitized,
      total: employees.length,  // Count after filtering
      page: parseInt(page),
      pages: Math.ceil(employees.length / parseInt(limit)),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── GET /api/employees/:id ─────────────────────────────────────────────────────
router.get('/:id', authorize('owner', 'admin', 'office_manager'), async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id).lean();
    if (!emp) return res.status(404).json({ message: 'Employee not found.' });
    if (req.user.role === 'admin' && !['office_manager', 'labor'].includes(emp.role)) {
      return res.status(403).json({ message: 'Access denied.' });
    }
    // Enrich with User.accountNumber as fallback for Chapa payments
    let accountNumber = emp.bankAccount || '';
    if (!accountNumber && emp.userId) {
      const User = require('../models/User');
      const usr  = await User.findById(emp.userId).select('accountNumber').lean();
      if (usr?.accountNumber) accountNumber = usr.accountNumber;
    }
    return res.json({ ...emp, accountNumber });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── POST /api/employees ────────────────────────────────────────────────────────
// Two modes:
// 1. If `userId` provided: Add employee information for existing active user
// 2. If `name`, `email`, `password` provided: Create User + Employee (legacy mode - kept for compatibility)
router.post('/', authorize('owner'), [
  body('userId').optional().isMongoId().withMessage('Invalid user ID.'),
  body('name').optional().trim().notEmpty().withMessage('Full name is required.'),
  body('email').optional().trim().normalizeEmail().isEmail().withMessage('A valid email address is required.'),
  body('password').optional().notEmpty().withMessage('Temporary password is required.')
    .matches(PW_REGEX).withMessage(
      'Password must be at least 8 characters and include uppercase, lowercase, a number and a special character.'
    ),
  body('role').optional()
    .isIn(EMPLOYEE_ROLES)
    .withMessage('Role must be admin, office_manager, or labor. Owner cannot be an employee.'),
  body('baseSalary').optional({ checkFalsy: true }).isFloat({ min: 0 })
    .withMessage('Salary must be a positive number.'),
  body('startDate').optional({ checkFalsy: true }).isISO8601()
    .withMessage('Invalid start date format.'),
], async (req, res) => {
  if (!validate(req, res)) return;

  const {
    userId, // For mode 1: link to existing user
    name, email, password, role, phone, // For mode 2: create new user
    department, jobTitle, employmentType,
    startDate, endDate, baseSalary,
    bankName, bankAccount, paymentMethod,
    assignedFarm, assignedZone, supervisorId,
    emergencyContact, notes, employeeId,
  } = req.body;

  try {
    // Mode 1: Add employee info for existing user
    if (userId) {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found.' });
      }
      if (user.accountStatus !== 'active') {
        return res.status(400).json({ message: 'User must be active to add employee information.' });
      }
      if (!EMPLOYEE_ROLES.includes(user.role)) {
        return res.status(400).json({ message: 'Owner cannot be an employee.' });
      }
      if (user.employeeId) {
        return res.status(409).json({ message: 'This user already has an employee record.' });
      }

      // Create employee record using helper
      const { createEmployeeForUser } = require('../utils/employeeHelper');
      const emp = await createEmployeeForUser(user, {
        createdBy: req.user.id,
        department, jobTitle, employmentType,
        startDate: startDate || new Date(),
        endDate, baseSalary: baseSalary || 0,
        bankName, bankAccount, paymentMethod: paymentMethod || 'bank_transfer',
        assignedFarm, assignedZone, supervisorId,
        emergencyContact, notes,
      });

      await History.create({
        event: 'Employee Information Added',
        userName: req.user.name,
        details: `"${user.name}" employee information added by ${req.user.name}`,
        type: 'success',
      }).catch(() => {});

      return res.status(201).json({
        message: 'Employee information added successfully!',
        employee: emp,
      });
    }

    // Mode 2: Create User + Employee (legacy mode)
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'Either userId or (name, email, password, role) must be provided.' });
    }

  // Check email uniqueness across Users collection
  const emailLower = email.trim().toLowerCase();
  const existingUser = await User.findOne({ email: emailLower });
  if (existingUser) {
    return res.status(409).json({
      message: `An account with email "${emailLower}" already exists.`,
    });
  }

  // ── Step 1: Create the User account ──────────────────────────────────────
  let newUser = null;
  try {
    newUser = await User.create({
      name:                name.trim(),
      email:               emailLower,
      password,                          // hashed by pre-save hook in User model
      role,
      phone:               phone      || '',
      department:          department || '',
      isActive:            true,
      mustChangePassword:  true,         // force password change on first login
      isTemporaryPassword: true,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        message: `Email "${emailLower}" is already registered.`,
      });
    }
    return res.status(500).json({ message: `Failed to create user account: ${err.message}` });
  }

  // ── Step 2: Create the Employee profile linked to the User ────────────────
  let emp = null;
  try {
    const empId = employeeId?.trim() || await generateEmployeeId();

    emp = await Employee.create({
      userId:         newUser._id,          // ← the required link
      employeeId:     empId,
      name:           name.trim(),
      email:          emailLower,
      role,
      phone:          phone          || '',
      department:     department     || '',
      jobTitle:       jobTitle       || '',
      employmentType: employmentType || 'permanent',
      startDate:      startDate ? new Date(startDate) : null,
      endDate:        endDate   ? new Date(endDate)   : null,
      baseSalary:     parseFloat(baseSalary || 0),
      bankName:       bankName       || '',
      bankAccount:    bankAccount    || '',
      paymentMethod:  paymentMethod  || 'bank_transfer',
      assignedFarm:   assignedFarm   || '',
      assignedZone:   assignedZone   || null,
      supervisorId:   supervisorId   || null,
      emergencyContact: emergencyContact || {},
      notes:          notes          || '',
      isActive:       true,
      createdBy:      req.user.id,
    });
  } catch (err) {
    // ── Rollback: delete the User we just created ─────────────────────────
    await User.findByIdAndDelete(newUser._id).catch(() => {});

    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || 'field';
      return res.status(409).json({
        message: `Duplicate value for "${field}". Employee may already exist.`,
      });
    }
    return res.status(500).json({ message: `Failed to create employee profile: ${err.message}` });
  }

  // ── Step 3: Back-link the Employee _id onto the User record ──────────────
  await User.findByIdAndUpdate(newUser._id, { employeeId: emp._id }).catch(() => {});

  await History.create({
    event:    'Employee Created',
    userName: req.user.name,
    details:  `Owner created employee "${name}" (${role}) — ${emp.employeeId} (temporary password set)`,
    type:     'success',
  }).catch(() => {});

  return res.status(201).json({
    employee: emp,
    userId:   newUser._id,
    message:  `Employee "${name}" and login account created successfully.`,
  });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── PUT /api/employees/:id ─────────────────────────────────────────────────────
// Updates HR fields only — does NOT touch the User account password.
router.put('/:id', authorize('owner', 'admin', 'office_manager'), [
  body('baseSalary').optional({ checkFalsy: true }).isFloat({ min: 0 }),
  body('startDate').optional({ checkFalsy: true }).isISO8601(),
  body('endDate').optional({ checkFalsy: true }).isISO8601(),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const emp = await Employee.findById(req.params.id);
    if (!emp) return res.status(404).json({ message: 'Employee not found.' });

    if (req.user.role === 'admin' && !['office_manager', 'labor'].includes(emp.role)) {
      return res.status(403).json({ message: 'Admin can only edit Office Manager or Laborer employees.' });
    }

    const editable = [
      'name', 'email', 'phone', 'department', 'jobTitle', 'employmentType',
      'baseSalary', 'bankName', 'bankAccount', 'paymentMethod',
      'assignedFarm', 'assignedZone', 'supervisorId', 'emergencyContact',
      'notes', 'isActive',
    ];
    for (const field of editable) {
      if (req.body[field] !== undefined) emp[field] = req.body[field];
    }
    if (req.body.startDate) emp.startDate = new Date(req.body.startDate);
    if (req.body.endDate)   emp.endDate   = new Date(req.body.endDate);

    await emp.save();

    // Mirror name / email / department onto the User record too
    if (emp.userId) {
      const userUpdates = {};
      if (req.body.name)       userUpdates.name       = emp.name;
      if (req.body.email)      userUpdates.email      = emp.email;
      if (req.body.department) userUpdates.department = emp.department;
      if (req.body.isActive !== undefined) userUpdates.isActive = emp.isActive;
      if (Object.keys(userUpdates).length) {
        await User.findByIdAndUpdate(emp.userId, userUpdates).catch(() => {});
      }
    }

    await History.create({
      event:    'Employee Updated',
      userName: req.user.name,
      details:  `${req.user.role} updated profile for ${emp.name}`,
      type:     'info',
    }).catch(() => {});

    return res.json(emp);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/employees/:id/activate ─────────────────────────────────────────
router.patch('/:id/activate', authorize('owner', 'office_manager'), async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id);
    if (!emp) return res.status(404).json({ message: 'Employee not found.' });

    emp.isActive = !emp.isActive;
    await emp.save();

    // Mirror active status onto User account
    if (emp.userId) {
      await User.findByIdAndUpdate(emp.userId, { isActive: emp.isActive }).catch(() => {});
    }

    await History.create({
      event:    emp.isActive ? 'Employee Activated' : 'Employee Deactivated',
      userName: req.user.name,
      details:  `${emp.name} — ${emp.isActive ? 'activated' : 'deactivated'}`,
      type:     emp.isActive ? 'success' : 'warning',
    }).catch(() => {});

    return res.json({
      message:  `Employee ${emp.isActive ? 'activated' : 'deactivated'}.`,
      isActive: emp.isActive,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── DELETE /api/employees/:id ──────────────────────────────────────────────────
// Deletes both the Employee profile and the linked User account.
router.delete('/:id', authorize('owner'), async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id);
    if (!emp) return res.status(404).json({ message: 'Employee not found.' });

    const linkedUserId = emp.userId;
    await emp.deleteOne();

    // Also delete the linked User account
    if (linkedUserId) {
      await User.findByIdAndDelete(linkedUserId).catch(() => {});
    }

    await History.create({
      event:    'Employee Deleted',
      userName: req.user.name,
      details:  `${emp.name} (${emp.role}) and their login account were deleted.`,
      type:     'warning',
    }).catch(() => {});

    return res.status(204).end();
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
