/**
 * Dashboard API — role-specific summary data
 *
 * Roles: owner > admin > office_manager > labor
 *
 * Owner    — full org + farm monitoring + financial overview
 * Admin    — technical ops: farms, sensors, devices, irrigation, tasks
 * Office Manager — HR: employees, attendance, tasks
 * Labor    — personal tasks only
 */

const express    = require('express');
const Zone       = require('../models/Zone');
const Sensor     = require('../models/Sensor');
const History    = require('../models/History');
const WaterUsage = require('../models/WaterUsage');
const Task          = require('../models/Task');
const User          = require('../models/User');
const Attendance    = require('../models/Attendance');
const Payroll       = require('../models/Payroll');
const Employee      = require('../models/Employee');
const ProblemReport = require('../models/ProblemReport');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ── Helper: sensor averages ───────────────────────────────────────────────────
async function getSensorAverages() {
  const onlineSensors = await Sensor.find({ online: true }).lean();
  const avg = (field) => onlineSensors.length
    ? +(onlineSensors.reduce((a, s) => a + (s.reading?.[field] ?? 0), 0) / onlineSensors.length).toFixed(1)
    : 0;
  return {
    onlineSensors,
    avgMoisture:   avg('moisture'),
    avgTemp:       avg('temp'),
    avgHumidity:   avg('humidity'),
    avgPh:         avg('ph'),
    avgWaterLevel: avg('waterLevel'),
  };
}

// ── GET /api/dashboard ────────────────────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const role  = req.user.role;
    const today = new Date().toISOString().split('T')[0];

    // ── OWNER: full org + farm monitoring ────────────────────────────────────
    if (role === 'owner') {
      const { onlineSensors, avgMoisture, avgTemp, avgHumidity, avgPh, avgWaterLevel } = await getSensorAverages();

      const [
        totalZones, activeZones, totalNodes, totalUsers,
        ownerCount, omCount, adminCount, laborCount,
        pendingTasks, inProgressTasks, completedTasks,
      ] = await Promise.all([
        Zone.countDocuments(),
        Zone.countDocuments({ active: true }),
        Sensor.countDocuments(),
        User.countDocuments(),
        User.countDocuments({ role: 'owner' }),
        User.countDocuments({ role: 'office_manager' }),
        User.countDocuments({ role: 'admin' }),
        User.countDocuments({ role: 'labor' }),
        Task.countDocuments({ status: 'pending' }),
        Task.countDocuments({ status: 'in_progress' }),
        Task.countDocuments({ status: 'completed' }),
      ]);

      const waterDoc = await WaterUsage.findOne({ date: today }).lean();

      return res.json({
        role: 'owner',
        // Org stats
        totalUsers, ownerCount, omCount, adminCount, laborCount,
        // Farm monitoring (owner inherits all farm features)
        totalZones, activeZones, totalNodes,
        onlineNodes:    onlineSensors.length,
        avgMoisture, avgTemp, avgHumidity, avgPh, avgWaterLevel,
        waterUsedToday: waterDoc?.waterLiters ?? 0,
        systemStatus:   onlineSensors.length > 0 ? 'online' : 'offline',
        // Tasks
        pendingTasks, inProgressTasks, completedTasks,
      });
    }

    // ── ADMIN: daily ops — farms, sensors, devices, tasks ───────────────────
    if (role === 'admin') {
      const { onlineSensors, avgMoisture, avgTemp } = await getSensorAverages();

      const [
        totalZones, activeZones, totalNodes,
        totalUsers, laborCount, omCount,
        pendingTasks, inProgressTasks, completedTasks,
      ] = await Promise.all([
        Zone.countDocuments(),
        Zone.countDocuments({ active: true }),
        Sensor.countDocuments(),
        User.countDocuments(),
        User.countDocuments({ role: 'labor' }),
        User.countDocuments({ role: 'office_manager' }),
        Task.countDocuments({ status: 'pending' }),
        Task.countDocuments({ status: 'in_progress' }),
        Task.countDocuments({ status: 'completed' }),
      ]);

      const waterDoc = await WaterUsage.findOne({ date: today }).lean();

      return res.json({
        role: 'admin',
        totalZones, activeZones, totalNodes,
        onlineNodes:    onlineSensors.length,
        avgMoisture, avgTemp,
        waterUsedToday: waterDoc?.waterLiters ?? 0,
        systemStatus:   onlineSensors.length > 0 ? 'online' : 'offline',
        totalUsers, laborCount, omCount,
        pendingTasks, inProgressTasks, completedTasks,
      });
    }

    // ── OFFICE MANAGER: HR / attendance / payroll ────────────────────────────
    if (role === 'office_manager') {
      const [
        totalUsers, laborCount, adminCount,
        pendingTasks, inProgressTasks, completedTasks,
        activeUsers,
      ] = await Promise.all([
        User.countDocuments({ accountStatus: 'active' }),
        User.countDocuments({ role: 'labor',   accountStatus: 'active' }),
        User.countDocuments({ role: 'admin',   accountStatus: 'active' }),
        Task.countDocuments({ status: 'pending' }),
        Task.countDocuments({ status: 'in_progress' }),
        Task.countDocuments({ status: 'completed' }),
        User.countDocuments({ accountStatus: 'active' }),
      ]);

      return res.json({
        role: 'office_manager',
        totalUsers, laborCount, adminCount, activeUsers,
        pendingTasks, inProgressTasks, completedTasks,
      });
    }

    // ── LABOR: personal dashboard summary ─────────────────────────────────────
    const emp = await Employee.findOne({ userId: req.user.id }).lean();
    const empId = emp ? emp._id : null;

    const now = new Date();
    const currentYr = now.getFullYear();
    const currentMo = String(now.getMonth() + 1).padStart(2, '0');
    const monthPrefix = `${currentYr}-${currentMo}`;

    const [
      myPending, myInProgress, myCompleted, myTotal,
      attRecords,
      latestPayroll,
      openReports, inReviewReports, resolvedReports,
      irrigationTasks,
      nextTask,
    ] = await Promise.all([
      Task.countDocuments({ assignedTo: req.user.id, status: 'pending' }),
      Task.countDocuments({ assignedTo: req.user.id, status: 'in_progress' }),
      Task.countDocuments({ assignedTo: req.user.id, status: 'completed' }),
      Task.countDocuments({ assignedTo: req.user.id }),

      // Attendance records for current month
      empId ? Attendance.find({
        employeeId: empId,
        date: { $gte: `${monthPrefix}-01`, $lte: `${monthPrefix}-31` }
      }).lean() : Promise.resolve([]),

      // Latest payroll record
      empId ? Payroll.findOne({ employeeId: empId }).sort({ year: -1, month: -1 }).lean() : Promise.resolve(null),

      // Problem reports
      ProblemReport.countDocuments({ reportedBy: req.user.id, status: 'open' }),
      ProblemReport.countDocuments({ reportedBy: req.user.id, status: 'in_review' }),
      ProblemReport.countDocuments({ reportedBy: req.user.id, status: 'resolved' }),

      // Irrigation tasks
      Task.find({ assignedTo: req.user.id, category: 'irrigation' })
        .sort({ status: 1, dueDate: 1 })
        .limit(10)
        .lean(),

      // Priority next task
      Task.findOne({
        assignedTo: req.user.id,
        status: { $in: ['pending', 'in_progress'] },
      }).sort({ priority: -1, dueDate: 1 }).lean(),
    ]);

    // Calculate attendance summary
    const presentDays   = attRecords.filter(r => ['present','late','half_day','overtime'].includes(r.status)).length;
    const absentDays    = attRecords.filter(r => r.status === 'absent').length;
    const leaveDays     = attRecords.filter(r => r.status === 'leave').length;
    const overtimeHours = +attRecords.reduce((s, r) => s + (r.overtimeHours || 0), 0).toFixed(2);

    const maskedPayroll = latestPayroll ? {
      ...latestPayroll,
      paymentRefMasked: latestPayroll.paymentRef
        ? '****' + String(latestPayroll.paymentRef).slice(-4)
        : '****1234'
    } : null;

    return res.json({
      role: 'labor',
      myPending, myInProgress, myCompleted, myTotal,
      todayTasks: {
        total: myPending + myInProgress + myCompleted,
        pending: myPending,
        inProgress: myInProgress,
        completed: myCompleted,
      },
      attendanceSummary: {
        presentDays,
        absentDays,
        leaveDays,
        overtimeHours,
        month: currentMo,
        year: currentYr,
      },
      payrollSummary: maskedPayroll,
      problemReportSummary: {
        open: openReports,
        inReview: inReviewReports,
        resolved: resolvedReports,
        total: openReports + inReviewReports + resolvedReports,
      },
      irrigationTasks,
      nextTask,
      employeeProfile: emp ? {
        employeeId: emp.employeeId,
        assignedFarm: emp.assignedFarm,
        jobTitle: emp.jobTitle,
        department: emp.department,
      } : null,
    });

  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── GET /api/dashboard/activity ───────────────────────────────────────────────
router.get('/activity', authenticate, async (req, res) => {
  try {
    const events = await History.find()
      .sort({ recordedAt: -1 })
      .limit(20)
      .lean();

    return res.json(events.map(e => ({
      id:      e._id,
      text:    e.event + (e.zoneName && e.zoneName !== '—' ? ` — ${e.zoneName}` : ''),
      event:   e.event,
      user:    e.userName,
      zone:    e.zoneName,
      details: e.details,
      type:    e.type,
      time:    new Date(e.recordedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    })));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── GET /api/dashboard/water-chart ───────────────────────────────────────────
router.get('/water-chart', authenticate, async (req, res) => {
  try {
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const d     = new Date(Date.now() - i * 86_400_000);
      const key   = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-US', { weekday: 'short' });
      const doc   = await WaterUsage.findOne({ date: key }).lean();
      result.push({ label, date: key, value: doc?.waterLiters ?? 0 });
    }
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── GET /api/dashboard/weather ────────────────────────────────────────────────
router.get('/weather', authenticate, (_req, res) => {
  const days  = ['Today', 'Tue', 'Wed', 'Thu', 'Fri'];
  const icons = ['☀️', '⛅', '🌧️', '🌤️', '⛅'];
  const highs = [28, 26, 22, 25, 27];
  const lows  = [18, 17, 15, 16, 17];
  return res.json(days.map((day, i) => ({ day, icon: icons[i], high: highs[i], low: lows[i] })));
});

module.exports = router;
