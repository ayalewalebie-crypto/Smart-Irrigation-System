/**
 * employeeHelper.js
 *
 * Shared utility for auto-creating and linking Employee records to User accounts.
 *
 * Rules:
 *  - Owner is an investor, NOT an employee → never create an Employee for owner.
 *  - Admin, Office Manager, and Laborer are both User and Employee.
 *  - Each non-owner user gets exactly one Employee record linked via User.employeeId.
 *  - Employee IDs are auto-generated: EMP-001, EMP-002, …
 */

const Employee = require('../models/Employee');
const User     = require('../models/User');

// Roles that have an Employee profile
const EMPLOYEE_ROLES = ['admin', 'office_manager', 'labor'];

/**
 * Generate a unique sequential employee ID, e.g. EMP-001
 */
async function generateEmployeeId() {
  // Find the highest existing numeric suffix
  const last = await Employee
    .findOne({ employeeId: /^EMP-\d+$/ })
    .sort({ employeeId: -1 })
    .lean();

  let next = 1;
  if (last?.employeeId) {
    const num = parseInt(last.employeeId.replace('EMP-', ''), 10);
    if (!isNaN(num)) next = num + 1;
  }
  return `EMP-${String(next).padStart(3, '0')}`;
}

/**
 * Create an Employee record for a user and link it back on the User document.
 *
 * @param {Object} user        - Mongoose User document (or plain object with _id, name, email, role, phone)
 * @param {Object} extra       - Optional overrides: { department, jobTitle, baseSalary, startDate, createdBy }
 * @returns {Object|null}      - The created Employee document, or null if the role is owner.
 */
async function createEmployeeForUser(user, extra = {}) {
  // Owner is not an employee — skip silently
  if (!EMPLOYEE_ROLES.includes(user.role)) return null;

  // Idempotent — if an Employee already exists for this user, return it
  const existing = await Employee.findOne({ userId: user._id }).lean();
  if (existing) {
    // Ensure User.employeeId is linked
    await User.findByIdAndUpdate(user._id, { employeeId: existing._id }).catch(() => {});
    return existing;
  }

  const employeeId = await generateEmployeeId();

  const emp = await Employee.create({
    userId:      user._id,
    employeeId,
    name:        user.name,
    email:       user.email,
    phone:       user.phone || '',
    role:        user.role,
    department:  extra.department  || '',
    jobTitle:    extra.jobTitle    || defaultJobTitle(user.role),
    baseSalary:  extra.baseSalary  || 0,
    startDate:   extra.startDate   || new Date(),
    isActive:    true,
    createdBy:   extra.createdBy   || null,
  });

  // Link back on the User document
  await User.findByIdAndUpdate(user._id, { employeeId: emp._id });

  return emp;
}

/**
 * Sync an existing Employee record when a user's role changes.
 * If the new role is 'owner', the Employee record is deleted and the link cleared.
 */
async function syncEmployeeRole(userId, newRole) {
  if (newRole === 'owner') {
    // Owner is not an employee — remove any existing employee record
    const emp = await Employee.findOneAndDelete({ userId });
    if (emp) {
      await User.findByIdAndUpdate(userId, { employeeId: null });
    }
    return null;
  }

  if (!EMPLOYEE_ROLES.includes(newRole)) return null;

  const emp = await Employee.findOne({ userId });
  if (emp) {
    emp.role = newRole;
    emp.jobTitle = emp.jobTitle || defaultJobTitle(newRole);
    await emp.save();
    return emp;
  }

  // No Employee record exists yet — create one (e.g. role changed from pending state)
  const user = await User.findById(userId).lean();
  if (user) return createEmployeeForUser(user);
  return null;
}

/**
 * Delete the Employee record linked to a user.
 * Called when a User account is permanently deleted.
 */
async function deleteEmployeeForUser(userId) {
  return Employee.findOneAndDelete({ userId });
}

/**
 * Default job title per role.
 */
function defaultJobTitle(role) {
  switch (role) {
    case 'admin':          return 'System Administrator';
    case 'office_manager': return 'Office Manager';
    case 'labor':          return 'Farm Laborer';
    default:               return '';
  }
}

module.exports = {
  createEmployeeForUser,
  syncEmployeeRole,
  deleteEmployeeForUser,
  generateEmployeeId,
  EMPLOYEE_ROLES,
};
