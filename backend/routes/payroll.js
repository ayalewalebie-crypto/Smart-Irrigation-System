/**
 * Payroll Routes — monthly ETB payroll management
 * Approval flow: draft → submitted → approved → paid | rejected
 *
 * Office Manager: create, calculate, submit, and process payment for ALL active employees
 *                 (admin, office_manager, and laborers)
 * Owner:          review submitted payroll, approve or reject, mark as paid, view all
 * Admin:          view all records only (read-only)
 * Labor:          view own payroll records only
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const Payroll        = require('../models/Payroll');
const Employee       = require('../models/Employee');
const Attendance     = require('../models/Attendance');
const FinancialAudit = require('../models/FinancialAudit');
const History        = require('../models/History');
const chapaService   = require('../utils/chapaService');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ message: errors.array().map(e => e.msg).join(' | ') });
    return false;
  }
  return true;
}

async function audit(action, payroll, user, notes = '') {
  try {
    await FinancialAudit.create({
      module: 'payroll', action,
      recordId: payroll._id,
      recordTitle: `Payroll: ${payroll.employeeName} - ${payroll.payPeriod}`,
      amount: payroll.netSalary,
      performedBy: user.id, performedByName: user.name, performedByRole: user.role,
      notes,
    });
  } catch (_) {}
}

/**
 * Ethiopian income tax calculation (2024 brackets)
 * Monthly gross salary thresholds in ETB
 */
function calcEthiopianTax(grossMonthly) {
  if (grossMonthly <= 600)   return 0;
  if (grossMonthly <= 1650)  return (grossMonthly - 600)  * 0.10;
  if (grossMonthly <= 3200)  return 105   + (grossMonthly - 1650) * 0.15;
  if (grossMonthly <= 5250)  return 337.5 + (grossMonthly - 3200) * 0.20;
  if (grossMonthly <= 7800)  return 747.5 + (grossMonthly - 5250) * 0.25;
  if (grossMonthly <= 10900) return 1385  + (grossMonthly - 7800) * 0.30;
  return 2315 + (grossMonthly - 10900) * 0.35;
}

function calcPayroll(data) {
  const baseSalary    = parseFloat(data.baseSalary    || 0);
  const overtimePay   = parseFloat(data.overtimePay   || 0);
  const bonus         = parseFloat(data.bonus         || 0);
  const allowance     = parseFloat(data.allowance     || 0);
  const otherEarnings = parseFloat(data.otherEarnings || 0);
  const grossSalary   = baseSalary + overtimePay + bonus + allowance + otherEarnings;

  const pensionEmployee = +(baseSalary * 0.07).toFixed(2);  // 7%
  const pensionEmployer = +(baseSalary * 0.11).toFixed(2);  // 11%
  const incomeTax       = +calcEthiopianTax(grossSalary).toFixed(2);
  const unpaidDays      = parseFloat(data.unpaidDays  || 0);
  const otherDeductions = parseFloat(data.otherDeductions || 0);
  const totalDeductions = pensionEmployee + incomeTax + unpaidDays + otherDeductions;
  const netSalary       = +(grossSalary - totalDeductions).toFixed(2);

  return { grossSalary: +grossSalary.toFixed(2), pensionEmployee, pensionEmployer, incomeTax, totalDeductions, netSalary };
}

function maskPayrollRecord(record) {
  if (!record) return record;
  const copy = { ...record };
  const rawRef = String(copy.paymentRef || '');
  if (rawRef && rawRef.length >= 4) {
    copy.paymentRefMasked = '****' + rawRef.slice(-4);
  } else {
    copy.paymentRefMasked = '****1234';
  }
  return copy;
}

// ── GET /api/payroll/my & /my-payroll — laborer's own payroll records ──────────
const getMyPayrollHandler = async (req, res) => {
  try {
    const emp = await Employee.findOne({ userId: req.user.id }).lean();

    // Build filter: match by employeeId (linked Employee record) OR by userId directly
    const orConditions = [{ userId: req.user.id }];
    if (emp) orConditions.push({ employeeId: emp._id });

    const records = await Payroll.find({ $or: orConditions })
      .sort({ year: -1, month: -1 })
      .lean();

    const masked = records.map(maskPayrollRecord);
    return res.json(masked);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

router.get('/my', getMyPayrollHandler);
router.get('/my-payroll', getMyPayrollHandler);

// ── GET /api/payroll ───────────────────────────────────────────────────────────
// Owner is not an employee — payroll records only exist for admin/office_manager/labor
router.get('/', authorize('owner', 'office_manager'), async (req, res) => {
  try {
    const { status, payPeriod, employeeId, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (status)     filter.status     = status;
    if (payPeriod)  filter.payPeriod  = payPeriod;
    if (employeeId) filter.employeeId = employeeId;

    // Never return payroll records for owner-role employees (there shouldn't be any, but enforce)
    filter.employeeRole = { $in: ['admin', 'office_manager', 'labor'] };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [records, total] = await Promise.all([
      Payroll.find(filter).sort({ year: -1, month: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      Payroll.countDocuments(filter),
    ]);
    return res.json({ records, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// ── GET /api/payroll/summary ───────────────────────────────────────────────────
router.get('/summary', authorize('owner', 'office_manager'), async (req, res) => {
  try {
    const { payPeriod } = req.query;
    const filter = payPeriod ? { payPeriod } : {};
    const records = await Payroll.find(filter).lean();
    const totalGross = records.reduce((s, r) => s + (r.grossSalary || 0), 0);
    const totalNet   = records.reduce((s, r) => s + (r.netSalary   || 0), 0);
    const totalTax   = records.reduce((s, r) => s + (r.incomeTax   || 0), 0);
    const byStatus   = {};
    for (const r of records) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    return res.json({ totalGross, totalNet, totalTax, byStatus, count: records.length });
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// ── GET /api/payroll/:id ───────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const record = await Payroll.findById(req.params.id).lean();
    if (!record) return res.status(404).json({ message: 'Payroll record not found.' });

    // owner / office_manager / admin with full access can view any record
    if (['owner', 'office_manager'].includes(req.user.role)) {
      return res.json(record);
    }

    // Admin: read-only, can view all
    if (req.user.role === 'admin') {
      return res.json(record);
    }

    // Everyone else: can only view their OWN record
    const emp = await Employee.findOne({ userId: req.user.id }).lean();
    const isOwn =
      String(record.userId) === String(req.user.id) ||
      (emp && String(record.employeeId) === String(emp._id));

    if (!isOwn)
      return res.status(403).json({ message: 'Access denied. You can only view your own payroll records.' });

    return res.json(maskPayrollRecord(record));
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// ── POST /api/payroll ──────────────────────────────────────────────────────────
router.post('/', authorize('office_manager', 'owner'), [
  body('employeeId').isMongoId().withMessage('Valid employee ID required.'),
  body('payPeriod').matches(/^\d{4}-\d{2}$/).withMessage('payPeriod must be YYYY-MM.'),
  body('baseSalary').isFloat({ min: 0 }).withMessage('Base salary required.'),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const emp = await Employee.findById(req.body.employeeId).lean();
    if (!emp) return res.status(404).json({ message: 'Employee not found.' });

    // Owner is not an employee — cannot receive payroll
    if (emp.role === 'owner') {
      return res.status(400).json({ message: 'The Owner is not an employee and cannot have a payroll record.' });
    }

    // Office Manager can only create payroll for admin, office_manager, and labor (not owner)
    // (already covered by the check above, but explicit for clarity)

    const [yr, mo]   = req.body.payPeriod.split('-').map(Number);
    const calculated = calcPayroll(req.body);

    // Get attendance summary for the month
    const startDate  = `${yr}-${String(mo).padStart(2,'0')}-01`;
    const endDate    = `${yr}-${String(mo).padStart(2,'0')}-31`;
    const attRecords = await Attendance.find({
      employeeId: emp._id,
      date: { $gte: startDate, $lte: endDate },
    }).lean();

    const workingDays  = attRecords.length;
    const presentDays  = attRecords.filter(a => ['present','late','half_day','overtime'].includes(a.status)).length;
    const absentDays   = attRecords.filter(a => a.status === 'absent').length;
    const leaveDays    = attRecords.filter(a => a.status === 'leave').length;
    const overtimeHrs  = attRecords.reduce((s, a) => s + (a.overtimeHours || 0), 0);

    const existing = await Payroll.findOne({ employeeId: emp._id, payPeriod: req.body.payPeriod });
    if (existing)
      return res.status(409).json({ message: `Payroll for ${emp.name} in ${req.body.payPeriod} already exists.` });

    const payroll = await Payroll.create({
      employeeId:     emp._id,
      userId:         emp.userId,
      employeeName:   emp.name,
      employeeRole:   emp.role,
      department:     emp.department || '',
      payPeriod:      req.body.payPeriod,
      month:          mo, year: yr,
      baseSalary:     parseFloat(req.body.baseSalary || emp.baseSalary),
      overtimePay:    parseFloat(req.body.overtimePay    || 0),
      bonus:          parseFloat(req.body.bonus           || 0),
      allowance:      parseFloat(req.body.allowance       || 0),
      otherEarnings:  parseFloat(req.body.otherEarnings   || 0),
      otherDeductions:parseFloat(req.body.otherDeductions || 0),
      unpaidDays:     parseFloat(req.body.unpaidDays      || 0),
      ...calculated,
      workingDays, presentDays, absentDays, leaveDays, overtimeHours: overtimeHrs,
      notes:      req.body.notes  || '',
      status:     'draft',
      createdBy:  req.user.id,
    });

    await audit('created', payroll, req.user);
    return res.status(201).json(payroll);
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// ── POST /api/payroll/bulk — generate payroll for all active employees ─────────
router.post('/bulk', authorize('office_manager', 'owner'), [
  body('payPeriod').matches(/^\d{4}-\d{2}$/).withMessage('payPeriod must be YYYY-MM.'),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    // Only admin, office_manager, and labor are employees — owners are investors, not employees
    const employees = await Employee.find({ isActive: true, role: { $in: ['admin', 'office_manager', 'labor'] } }).lean();
    if (!employees.length) return res.status(400).json({ message: 'No active employees found.' });

    const [yr, mo] = req.body.payPeriod.split('-').map(Number);
    const results = { created: [], skipped: [], errors: [] };

    for (const emp of employees) {
      try {
        const existing = await Payroll.findOne({ employeeId: emp._id, payPeriod: req.body.payPeriod });
        if (existing) { results.skipped.push(emp.name); continue; }

        // Skip employees with no salary set — cannot create valid payroll
        if (!emp.baseSalary || emp.baseSalary <= 0) {
          results.errors.push({ name: emp.name, error: 'No base salary configured. Set salary in Employee Management first.' });
          continue;
        }

        const calculated = calcPayroll({ baseSalary: emp.baseSalary || 0 });

        const startDate  = `${yr}-${String(mo).padStart(2,'0')}-01`;
        const endDate    = `${yr}-${String(mo).padStart(2,'0')}-31`;
        const attRecords = await Attendance.find({
          employeeId: emp._id, date: { $gte: startDate, $lte: endDate }
        }).lean();
        const workingDays  = attRecords.length;
        const presentDays  = attRecords.filter(a => ['present','late','half_day','overtime'].includes(a.status)).length;
        const absentDays   = attRecords.filter(a => a.status === 'absent').length;
        const leaveDays    = attRecords.filter(a => a.status === 'leave').length;
        const overtimeHrs  = attRecords.reduce((s, a) => s + (a.overtimeHours || 0), 0);

        const payroll = await Payroll.create({
          employeeId: emp._id, userId: emp.userId,
          employeeName: emp.name, employeeRole: emp.role,
          department: emp.department || '',
          payPeriod: req.body.payPeriod, month: mo, year: yr,
          baseSalary: emp.baseSalary || 0,
          ...calculated,
          workingDays, presentDays, absentDays, leaveDays, overtimeHours: overtimeHrs,
          status: 'draft', createdBy: req.user.id,
        });
        results.created.push(emp.name);
        await audit('created', payroll, req.user, 'bulk generation');
      } catch (e) { results.errors.push({ name: emp.name, error: e.message }); }
    }

    return res.json({ message: 'Bulk payroll generation complete.', ...results });
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// ── PUT /api/payroll/:id ───────────────────────────────────────────────────────
router.put('/:id', authorize('office_manager', 'owner'), [
  body('baseSalary').optional().isFloat({ min: 0 }),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const payroll = await Payroll.findById(req.params.id);
    if (!payroll) return res.status(404).json({ message: 'Payroll record not found.' });
    if (payroll.status !== 'draft' && req.user.role !== 'owner')
      return res.status(400).json({ message: 'Only draft payroll can be edited.' });

    const fields = ['baseSalary','overtimePay','bonus','allowance','otherEarnings','unpaidDays','otherDeductions','notes'];
    for (const f of fields) {
      if (req.body[f] !== undefined) payroll[f] = parseFloat(req.body[f]) || 0;
    }
    const calc = calcPayroll(payroll);
    Object.assign(payroll, calc);
    await payroll.save();
    await audit('updated', payroll, req.user);
    return res.json(payroll);
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// ── PATCH /api/payroll/:id/submit ─────────────────────────────────────────────
router.patch('/:id/submit', authorize('office_manager', 'owner'), async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id);
    if (!payroll) return res.status(404).json({ message: 'Payroll record not found.' });
    if (payroll.status !== 'draft')
      return res.status(400).json({ message: 'Only draft payroll can be submitted.' });
    payroll.status      = 'submitted';
    payroll.submittedBy = req.user.id;
    payroll.submittedAt = new Date();
    await payroll.save();
    await audit('submitted', payroll, req.user);
    return res.json(payroll);
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// ── PATCH /api/payroll/:id/approve — OWNER ONLY ───────────────────────────────
router.patch('/:id/approve', authorize('owner'), async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id);
    if (!payroll) return res.status(404).json({ message: 'Payroll record not found.' });
    if (payroll.status !== 'submitted')
      return res.status(400).json({ message: 'Only submitted payroll can be approved.' });
    payroll.status     = 'approved';
    payroll.approvedBy = req.user.id;
    payroll.approvedAt = new Date();
    await payroll.save();
    await audit('approved', payroll, req.user);
    await History.create({
      event: 'Payroll Approved', userName: req.user.name,
      details: `Payroll for ${payroll.employeeName} (${payroll.payPeriod}) — ${payroll.netSalary.toLocaleString('en-ET')} ETB approved`,
      type: 'success',
    });
    return res.json(payroll);
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// ── PATCH /api/payroll/:id/reject — OWNER ONLY ────────────────────────────────
router.patch('/:id/reject', authorize('owner'), [
  body('reason').trim().notEmpty().withMessage('Rejection reason is required.'),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const payroll = await Payroll.findById(req.params.id);
    if (!payroll) return res.status(404).json({ message: 'Payroll record not found.' });
    if (!['submitted','approved'].includes(payroll.status))
      return res.status(400).json({ message: 'Cannot reject this payroll.' });
    payroll.status          = 'rejected';
    payroll.rejectionReason = req.body.reason;
    await payroll.save();
    await audit('rejected', payroll, req.user, req.body.reason);
    return res.json(payroll);
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// ── POST /api/payroll/:id/chapa-checkout — initialize Chapa checkout redirect ─
router.patch('/:id/chapa-checkout', authorize('office_manager'), async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id);
    if (!payroll) return res.status(404).json({ message: 'Payroll record not found.' });
    if (payroll.status !== 'approved')
      return res.status(400).json({ message: 'Only approved payroll can be paid.' });
    if (!payroll.netSalary || payroll.netSalary <= 0)
      return res.status(400).json({ message: `Net salary is ETB 0.00. Edit this payroll record to set the correct base salary first.` });

    const emp        = await Employee.findById(payroll.employeeId).lean();
    if (!emp) return res.status(404).json({ message: 'Employee record not found.' });

    const User       = require('../models/User');
    const userRecord = await User.findById(payroll.userId).lean();

    const txRef       = chapaService.genPayRef(payroll._id);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const callbackUrl = process.env.CHAPA_CALLBACK_URL || `http://localhost:8000/api/payroll/chapa/callback`;
    const returnUrl   = `${frontendUrl}/payment/success?payrollId=${payroll._id}&tx_ref=${txRef}`;
    const cancelUrl   = `${frontendUrl}/payment/cancel?payrollId=${payroll._id}&tx_ref=${txRef}`;

    console.log(`[Chapa Checkout] Initializing for ${emp.name} — ETB ${payroll.netSalary} ref=${txRef}`);

    const result = await chapaService.initializeCheckout({
      employeeName:  emp.name,
      employeeEmail: emp.email || userRecord?.email || 'noreply@farm.com',
      phone:         emp.phone || userRecord?.phone || '0911000000',
      amount:        payroll.netSalary,
      txRef,
      payPeriod:     payroll.payPeriod,
      callbackUrl,
      returnUrl,
      cancelUrl,
    });

    console.log(`[Chapa Checkout] url=${result.checkoutUrl?.substring(0, 80)}`);

    // Store txRef on payroll so callback can find it
    await Payroll.findByIdAndUpdate(req.params.id, { paymentRef: txRef });

    return res.json({
      checkoutUrl: result.checkoutUrl,
      txRef:       result.txRef,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── GET /api/payroll/chapa/verify-payment/:txRef — verify after redirect ──────
router.get('/chapa/verify-payment/:txRef', authorize('office_manager', 'owner'), async (req, res) => {
  try {
    const { txRef } = req.params;

    // Find the payroll by paymentRef
    const payroll = await Payroll.findOne({ paymentRef: txRef });
    if (!payroll) return res.status(404).json({ message: 'Payroll record not found for this reference.' });

    if (payroll.status === 'paid') {
      return res.json({ alreadyPaid: true, payroll });
    }

    // Verify with Chapa
    let chapaStatus = 'failed';
    try {
      const verification = await chapaService.verifyPayment(txRef);
      chapaStatus = verification?.data?.status || 'failed';
    } catch (_) {
      chapaStatus = 'failed';
    }

    if (chapaStatus !== 'success') {
      return res.status(400).json({ message: `Payment not confirmed. Chapa status: ${chapaStatus}` });
    }

    // Mark payroll as paid
    payroll.status     = 'paid';
    payroll.paidBy     = req.user.id;
    payroll.paidAt     = new Date();
    await payroll.save();

    await audit('paid', payroll, req.user, `Chapa checkout ref: ${txRef}`);
    await History.create({
      event: 'Salary Paid via Chapa', userName: req.user.name,
      details: `${payroll.employeeName} — ${payroll.netSalary.toLocaleString('en-ET')} ETB (${payroll.payPeriod}) ref: ${txRef}`,
      type: 'success',
    }).catch(() => {});

    // Auto-update budget salaries category
    try {
      const Budget = require('../models/Budget');
      const [yr]   = (payroll.payPeriod || '').split('-').map(Number);
      const budget = await Budget.findOne({ status: 'active', year: yr || new Date().getFullYear() });
      if (budget) {
        const salCat = budget.categories.find(c => c.name === 'salaries');
        if (salCat) { salCat.used = (salCat.used || 0) + (payroll.netSalary || 0); await budget.save(); }
      }
    } catch (_) {}

    return res.json({
      message:    `Payment verified. Salary paid to ${payroll.employeeName}.`,
      payrollId:  payroll._id,
      netSalary:  payroll.netSalary,
      txRef,
      status:     'paid',
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/payroll/:id/pay — Chapa salary transfer (Office Manager only) ──
router.patch('/:id/pay', authorize('office_manager'), async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id);
    if (!payroll) return res.status(404).json({ message: 'Payroll record not found.' });
    if (payroll.status !== 'approved')
      return res.status(400).json({ message: 'Only approved payroll can be paid.' });
    if (!payroll.netSalary || payroll.netSalary <= 0)
      return res.status(400).json({ message: `Net salary is ETB 0.00 for ${payroll.employeeName}. Edit this payroll record to set the correct base salary first.` });

    const emp = await Employee.findById(payroll.employeeId).lean();
    if (!emp) return res.status(404).json({ message: 'Employee record not found.' });

    const User       = require('../models/User');
    const userRecord = await User.findById(payroll.userId).lean();

    // Resolve account number: prefer Employee.bankAccount, fall back to User.accountNumber
    const accountNumber = emp.bankAccount || userRecord?.accountNumber || '';
    if (!accountNumber)
      return res.status(400).json({
        message: `${emp.name} has no account number. Set it in Employee Management or ask them to add it in their profile.`,
      });

    // Resolve bank code from bank name using static list
    const { ETHIOPIAN_BANKS } = require('../utils/chapaService');
    const bankEntry = ETHIOPIAN_BANKS.find(
      b => b.name.toLowerCase() === (emp.bankName || '').toLowerCase()
    );
    const bankCode = emp.bankCode || bankEntry?.id;
    if (!bankCode)
      return res.status(400).json({
        message: `${emp.name} has no bank selected. Go to Employee Management → Edit → select a bank.`,
      });

    const reference = chapaService.genPayRef(payroll._id);

    const result = await chapaService.paySalary({
      accountName:   emp.name,
      accountNumber: accountNumber,
      bankCode:      bankCode,
      amount:        payroll.netSalary,
      reference,
      narration:     `Salary for ${payroll.employeeName} — ${payroll.payPeriod}`,
    });

    payroll.status     = 'paid';
    payroll.paidBy     = req.user.id;
    payroll.paidAt     = new Date();
    payroll.paymentRef = result.chapaRef || reference;
    await payroll.save();

    await audit('paid', payroll, req.user, `Chapa ref: ${payroll.paymentRef}`);
    await History.create({
      event: 'Salary Paid via Chapa', userName: req.user.name,
      details: `${payroll.employeeName} — ${payroll.netSalary.toLocaleString('en-ET')} ETB (${payroll.payPeriod}) ref: ${payroll.paymentRef}`,
      type: 'success',
    }).catch(() => {});

    // Auto-update budget salaries category when payroll is paid
    try {
      const Budget = require('../models/Budget');
      const [yr, mo] = (payroll.payPeriod || '').split('-').map(Number);
      const activeBudget = await Budget.findOne({
        status: 'active',
        year: yr || new Date().getFullYear(),
      });
      if (activeBudget) {
        const salCat = activeBudget.categories.find(c => c.name === 'salaries');
        if (salCat) {
          salCat.used = (salCat.used || 0) + (payroll.netSalary || 0);
          await activeBudget.save();
        }
      }
    } catch (_) {}

    return res.json({
      message:    `Salary paid to ${emp.name} via Chapa.`,
      txRef:      result.txRef,
      chapaRef:   result.chapaRef,
      netSalary:  payroll.netSalary,
      paymentRef: payroll.paymentRef,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── POST /api/payroll/bulk-pay — bulk Chapa payment (Office Manager only) ─────
router.post('/bulk-pay', authorize('office_manager'), [
  body('payPeriod').trim().notEmpty().withMessage('payPeriod is required (YYYY-MM).'),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const { payPeriod } = req.body;
    const approved = await Payroll.find({ payPeriod, status: 'approved' }).lean();
    if (approved.length === 0)
      return res.status(400).json({ message: `No approved payroll records found for ${payPeriod}.` });

    const empIds    = approved.map(p => p.employeeId);
    const userIds   = approved.map(p => p.userId);
    const employees = await Employee.find({ _id: { $in: empIds } }).lean();
    const User      = require('../models/User');
    const { ETHIOPIAN_BANKS } = require('../utils/chapaService');
    const users     = await User.find({ _id: { $in: userIds } }).lean();
    const empMap    = Object.fromEntries(employees.map(e => [String(e._id), e]));
    const userMap   = Object.fromEntries(users.map(u => [String(u._id), u]));

    const missing = [];
    const bulk    = [];

    for (const p of approved) {
      const emp  = empMap[String(p.employeeId)];
      const usr  = userMap[String(p.userId)];
      const accountNumber = emp?.bankAccount || usr?.accountNumber || '';
      const bankEntry     = ETHIOPIAN_BANKS.find(b => b.name.toLowerCase() === (emp?.bankName || '').toLowerCase());
      const bankCode      = emp?.bankCode || bankEntry?.id;

      if (!emp || !accountNumber || !bankCode) {
        missing.push(`${p.employeeName}: missing ${!accountNumber ? 'account number' : 'bank selection'}`);
        continue;
      }
      bulk.push({
        payrollId:     p._id,
        accountName:   emp.name,
        accountNumber: accountNumber,
        bankCode:      bankCode,
        amount:        p.netSalary,
        reference:     chapaService.genPayRef(p._id),
      });
    }

    if (bulk.length === 0)
      return res.status(400).json({ message: 'No employees have complete bank info.', missing });

    const result = await chapaService.payBulkSalary(
      `Payroll ${payPeriod} — Smart Irrigation Farm`,
      bulk
    );

    // Mark all successfully queued as paid
    const now    = new Date();
    const paid   = [];
    const errors = [];

    for (const b of bulk) {
      try {
        await Payroll.findByIdAndUpdate(b.payrollId, {
          status:     'paid',
          paidBy:     req.user.id,
          paidAt:     now,
          paymentRef: b.reference,
        });
        paid.push({ name: b.accountName, ref: b.reference, amount: b.amount });
        await audit('paid', { _id: b.payrollId, employeeName: b.accountName, payPeriod, netSalary: b.amount }, req.user, `Bulk Chapa ref: ${b.reference}`);
      } catch (e) { errors.push({ name: b.accountName, error: e.message }); }
    }

    await History.create({
      event: 'Bulk Salary Paid via Chapa', userName: req.user.name,
      details: `Paid ${paid.length} employees for ${payPeriod} via Chapa bulk transfer (ID: ${result.bulkId})`,
      type: 'success',
    }).catch(() => {});

    return res.json({
      message:   `Bulk payment initiated for ${paid.length} employee(s).`,
      bulkId:    result.bulkId,
      paid,
      missing,
      errors,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── GET /api/payroll/chapa/banks — list Chapa supported banks ─────────────────
router.get('/chapa/banks', authorize('owner', 'office_manager'), async (req, res) => {
  try {
    const banks = await chapaService.getBanks();
    return res.json({ banks, source: banks === chapaService.ETHIOPIAN_BANKS ? 'static' : 'live' });
  } catch (err) {
    // Always return static list even if something goes wrong
    return res.json({ banks: chapaService.ETHIOPIAN_BANKS, source: 'static' });
  }
});

// ── GET /api/payroll/chapa/verify/:txRef — verify a transfer status ───────────
router.get('/chapa/verify/:txRef', authorize('owner'), async (req, res) => {
  try {
    const result = await chapaService.verifyTransfer(req.params.txRef);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── POST /api/payroll/chapa/callback — Chapa webhook ─────────────────────────
router.post('/chapa/callback', async (req, res) => {
  try {
    const { tx_ref, status } = req.body;
    if (!tx_ref) return res.status(400).json({ message: 'tx_ref required.' });

    if (status === 'success') {
      await Payroll.findOneAndUpdate(
        { paymentRef: tx_ref },
        { $set: { status: 'paid', paidAt: new Date() } }
      ).catch(() => {});
    }
    return res.json({ received: true });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── DELETE /api/payroll/:id ────────────────────────────────────────────────────
router.delete('/:id', authorize('owner'), async (req, res) => {
  try {
    const payroll = await Payroll.findByIdAndDelete(req.params.id);
    if (!payroll) return res.status(404).json({ message: 'Payroll record not found.' });
    await audit('deleted', payroll, req.user);
    return res.status(204).end();
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

module.exports = router;
