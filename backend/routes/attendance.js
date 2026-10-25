/**
 * Attendance Routes — daily employee attendance management
 *
 * Owner:          view all records, summary stats, full CRUD
 * Admin:          view all records, summary stats (read-only)
 * Office Manager: full CRUD — but only for LABORER employees
 *                 (cannot record attendance for admin or other office managers)
 * Labor:          view own records only
 */

const express     = require('express');
const { body, validationResult } = require('express-validator');
const Attendance  = require('../models/Attendance');
const Employee    = require('../models/Employee');
const History     = require('../models/History');
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

/** Calculate work hours from HH:MM check-in/out strings */
function calcWorkHours(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const [inH, inM]   = checkIn.split(':').map(Number);
  const [outH, outM] = checkOut.split(':').map(Number);
  const mins = (outH * 60 + outM) - (inH * 60 + inM);
  return mins > 0 ? +(mins / 60).toFixed(2) : 0;
}

/** Calculate overtime hours (work > 8h standard) */
function calcOvertime(workHours) {
  return workHours > 8 ? +(workHours - 8).toFixed(2) : 0;
}

// ── GET /api/attendance/me & /my-attendance — laborer's own attendance ─────────
const getMyAttendanceHandler = async (req, res) => {
  try {
    const emp = await Employee.findOne({ userId: req.user.id }).lean();
    const filter = emp ? { employeeId: emp._id } : { userId: req.user.id };

    const { from, to, month, year } = req.query;
    const now = new Date();
    const targetYear  = year  ? parseInt(year)  : now.getFullYear();
    const targetMonth = month ? parseInt(month) : (now.getMonth() + 1);
    const m = String(targetMonth).padStart(2, '0');

    if (month && year) {
      filter.date = { $gte: `${targetYear}-${m}-01`, $lte: `${targetYear}-${m}-31` };
    } else if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = from;
      if (to)   filter.date.$lte = to;
    }

    const records = await Attendance.find(filter).sort({ date: -1 }).lean();

    // Calculate monthly summary
    const monthPrefix = `${targetYear}-${m}`;
    const monthlyRecords = records.filter(r => r.date && r.date.startsWith(monthPrefix));
    
    const summary = {
      presentDays:   monthlyRecords.filter(r => ['present','late','half_day','overtime'].includes(r.status)).length,
      absentDays:    monthlyRecords.filter(r => r.status === 'absent').length,
      leaveDays:     monthlyRecords.filter(r => r.status === 'leave').length,
      overtimeHours: +monthlyRecords.reduce((s, r) => s + (r.overtimeHours || 0), 0).toFixed(2),
      totalWorkHours:+monthlyRecords.reduce((s, r) => s + (r.workHours || 0), 0).toFixed(2),
      month:         targetMonth,
      year:          targetYear,
    };

    return res.json({ records, summary });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

router.get('/me', getMyAttendanceHandler);
router.get('/my-attendance', getMyAttendanceHandler);

// ── GET /api/attendance ────────────────────────────────────────────────────────
router.get('/', authorize('owner', 'admin', 'office_manager'), async (req, res) => {
  try {
    const { employeeId, status, from, to, month, year, page = 1, limit = 100 } = req.query;
    const filter = {};
    if (employeeId) filter.employeeId = employeeId;
    if (status)     filter.status     = status;

    // Office Manager can only view attendance for LABORERS
    if (req.user.role === 'office_manager') {
      const laborers = await Employee.find({ role: 'labor' }, '_id').lean();
      const laborIds = laborers.map(e => e._id);
      filter.employeeId = employeeId
        ? (laborIds.some(id => String(id) === employeeId) ? employeeId : null)
        : { $in: laborIds };
      if (filter.employeeId === null)
        return res.json({ records: [], total: 0, page: 1, pages: 0 });
    }

    if (month && year) {
      const m = String(month).padStart(2, '0');
      filter.date = { $gte: `${year}-${m}-01`, $lte: `${year}-${m}-31` };
    } else if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = from;
      if (to)   filter.date.$lte = to;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [records, total] = await Promise.all([
      Attendance.find(filter).sort({ date: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      Attendance.countDocuments(filter),
    ]);
    return res.json({ records, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// ── GET /api/attendance/summary ────────────────────────────────────────────────
router.get('/summary', authorize('owner', 'admin', 'office_manager'), async (req, res) => {
  try {
    const { month, year } = req.query;
    const filter = {};

    // Office Manager summary covers only laborer attendance
    if (req.user.role === 'office_manager') {
      const laborers = await Employee.find({ role: 'labor' }, '_id').lean();
      filter.employeeId = { $in: laborers.map(e => e._id) };
    }

    if (month && year) {
      const m = String(month).padStart(2, '0');
      filter.date = { $gte: `${year}-${m}-01`, $lte: `${year}-${m}-31` };
    }

    const records = await Attendance.find(filter).lean();
    const byStatus = {};
    let totalWorkHours = 0, totalOvertimeHours = 0;

    for (const r of records) {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      totalWorkHours    += r.workHours    || 0;
      totalOvertimeHours += r.overtimeHours || 0;
    }

    const presentCount = (byStatus['present'] || 0) + (byStatus['late'] || 0) +
                         (byStatus['half_day'] || 0) + (byStatus['overtime'] || 0);

    return res.json({
      total: records.length,
      present: presentCount,
      absent:  byStatus['absent']  || 0,
      leave:   byStatus['leave']   || 0,
      late:    byStatus['late']    || 0,
      holiday: byStatus['holiday'] || 0,
      byStatus,
      totalWorkHours:    +totalWorkHours.toFixed(1),
      totalOvertimeHours: +totalOvertimeHours.toFixed(1),
    });
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// ── GET /api/attendance/monthly/:empId/:yearMonth ──────────────────────────────
router.get('/monthly/:empId/:yearMonth', authorize('owner', 'admin', 'office_manager'), async (req, res) => {
  try {
    const { empId, yearMonth } = req.params; // yearMonth = "YYYY-MM"
    const [yr, mo] = yearMonth.split('-');
    const m = String(mo).padStart(2, '0');

    const records = await Attendance.find({
      employeeId: empId,
      date: { $gte: `${yr}-${m}-01`, $lte: `${yr}-${m}-31` },
    }).sort({ date: 1 }).lean();

    const summary = {
      workingDays:  records.length,
      presentDays:  records.filter(r => ['present','late','half_day','overtime'].includes(r.status)).length,
      absentDays:   records.filter(r => r.status === 'absent').length,
      leaveDays:    records.filter(r => r.status === 'leave').length,
      overtimeHours: +records.reduce((s, r) => s + (r.overtimeHours || 0), 0).toFixed(2),
      totalWorkHours: +records.reduce((s, r) => s + (r.workHours    || 0), 0).toFixed(2),
    };

    return res.json({ records, summary });
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// ── GET /api/attendance/:id ────────────────────────────────────────────────────
router.get('/:id', authorize('owner', 'admin', 'office_manager'), async (req, res) => {
  try {
    const record = await Attendance.findById(req.params.id).lean();
    if (!record) return res.status(404).json({ message: 'Attendance record not found.' });
    return res.json(record);
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// ── POST /api/attendance ───────────────────────────────────────────────────────
router.post('/', authorize('office_manager', 'owner'), [
  body('employeeId').isMongoId().withMessage('Valid employee ID required.'),
  body('date').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Date must be YYYY-MM-DD.'),
  body('status').isIn(['present','absent','late','half_day','leave','holiday','overtime'])
    .withMessage('Invalid attendance status.'),
  body('checkIn').optional({ checkFalsy: true }).matches(/^\d{2}:\d{2}$/).withMessage('checkIn must be HH:MM.'),
  body('checkOut').optional({ checkFalsy: true }).matches(/^\d{2}:\d{2}$/).withMessage('checkOut must be HH:MM.'),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const { employeeId, date, status, checkIn, checkOut, leaveType, notes } = req.body;

    const emp = await Employee.findById(employeeId).lean();
    if (!emp) return res.status(404).json({ message: 'Employee not found.' });

    // Attendance is only for Laborers. Admin and Office Manager are employees
    // but are not attendance subjects. Owner is not an employee at all.
    if (emp.role !== 'labor') {
      return res.status(400).json({
        message: `Attendance can only be recorded for Laborers. "${emp.name}" has role "${emp.role}" and does not have attendance records.`,
      });
    }

    // Office Manager can only record attendance for LABORERS (redundant here but explicit)
    if (req.user.role === 'office_manager' && emp.role !== 'labor') {
      return res.status(403).json({
        message: 'Office Manager can only record attendance for Laborers.',
      });
    }

    // Prevent duplicate
    const existing = await Attendance.findOne({ employeeId, date });
    if (existing)
      return res.status(409).json({ message: `Attendance for ${emp.name} on ${date} already recorded.` });

    const workHours    = calcWorkHours(checkIn, checkOut);
    const overtimeHours = calcOvertime(workHours);

    const record = await Attendance.create({
      employeeId,
      userId:       emp.userId,
      employeeName: emp.name,
      date, status,
      checkIn:      checkIn    || '',
      checkOut:     checkOut   || '',
      workHours,
      overtimeHours,
      leaveType:    leaveType  || '',
      notes:        notes      || '',
      recordedBy:   req.user.id,
    });

    return res.status(201).json(record);
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// ── POST /api/attendance/bulk ──────────────────────────────────────────────────
router.post('/bulk', authorize('office_manager', 'owner'), [
  body('date').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Date must be YYYY-MM-DD.'),
  body('records').isArray({ min: 1 }).withMessage('Records array is required.'),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const { date, records } = req.body;
    const results = { created: 0, skipped: 0, errors: [] };

    for (const r of records) {
      try {
        const emp = await Employee.findById(r.employeeId).lean();
        if (!emp) { results.errors.push({ id: r.employeeId, error: 'Not found' }); continue; }

        // Only laborers have attendance records
        if (emp.role !== 'labor') {
          results.errors.push({ id: r.employeeId, name: emp.name, error: `Attendance only applies to Laborers. "${emp.name}" is ${emp.role}.` });
          continue;
        }

        // Office Manager can only record attendance for LABORERS
        if (req.user.role === 'office_manager' && emp.role !== 'labor') {
          results.errors.push({ id: r.employeeId, name: emp.name, error: 'Office Manager can only mark attendance for Laborers.' });
          continue;
        }

        const existing = await Attendance.findOne({ employeeId: r.employeeId, date });
        if (existing) { results.skipped++; continue; }

        const workHours     = calcWorkHours(r.checkIn, r.checkOut);
        const overtimeHours = calcOvertime(workHours);

        await Attendance.create({
          employeeId:   r.employeeId,
          userId:       emp.userId,
          employeeName: emp.name,
          date, status: r.status || 'present',
          checkIn:  r.checkIn  || '',
          checkOut: r.checkOut || '',
          workHours, overtimeHours,
          leaveType: r.leaveType || '',
          notes:     r.notes     || '',
          recordedBy: req.user.id,
        });
        results.created++;
      } catch (e) { results.errors.push({ id: r.employeeId, error: e.message }); }
    }

    return res.json({ message: 'Bulk attendance recorded.', ...results });
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// ── PUT /api/attendance/:id ────────────────────────────────────────────────────
router.put('/:id', authorize('office_manager', 'owner'), [
  body('status').optional().isIn(['present','absent','late','half_day','leave','holiday','overtime']),
  body('checkIn').optional({ checkFalsy: true }).matches(/^\d{2}:\d{2}$/),
  body('checkOut').optional({ checkFalsy: true }).matches(/^\d{2}:\d{2}$/),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const record = await Attendance.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Attendance record not found.' });

    // Verify the employee linked to this record is a laborer
    const emp = await Employee.findById(record.employeeId).lean();
    if (emp && emp.role !== 'labor') {
      return res.status(400).json({ message: 'Attendance records only exist for Laborers.' });
    }

    // Office Manager can only edit attendance for LABORERS
    if (req.user.role === 'office_manager') {
      if (emp && emp.role !== 'labor') {
        return res.status(403).json({ message: 'Office Manager can only edit attendance for Laborers.' });
      }
    }

    const fields = ['status','checkIn','checkOut','leaveType','notes'];
    for (const f of fields) {
      if (req.body[f] !== undefined) record[f] = req.body[f];
    }

    // Recalculate hours if check-in/out changed
    record.workHours     = calcWorkHours(record.checkIn, record.checkOut);
    record.overtimeHours = calcOvertime(record.workHours);

    await record.save();
    return res.json(record);
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// ── DELETE /api/attendance/:id ─────────────────────────────────────────────────
router.delete('/:id', authorize('owner', 'office_manager'), async (req, res) => {
  try {
    const record = await Attendance.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Attendance record not found.' });

    // Office Manager can only delete attendance for LABORERS
    if (req.user.role === 'office_manager') {
      const emp = await Employee.findById(record.employeeId).lean();
      if (emp && emp.role !== 'labor') {
        return res.status(403).json({ message: 'Office Manager can only delete attendance for Laborers.' });
      }
    }

    await Attendance.findByIdAndDelete(req.params.id);
    return res.status(204).end();
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

module.exports = router;
