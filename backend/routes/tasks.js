/**
 * Tasks Route
 *
 * Admin:   create, update, delete, list all tasks, assign to laborer
 * Laborer: list own tasks, update status (pending → in_progress → completed), submit report
 * Farmer:  list own zone tasks (read only)
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const Task    = require('../models/Task');
const History = require('../models/History');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ message: errors.array().map(e => e.msg).join(' | ') });
    return false;
  }
  return true;
}

const STATUS_FLOW = {
  pending:     'in_progress',
  in_progress: 'completed',
  overdue:     'in_progress',  // laborer can start an overdue task
};
const LABORER_VALID_STATUSES = ['in_progress', 'completed', 'unable_to_complete'];

// ── GET /api/tasks/my-tasks — tasks assigned to authenticated laborer ───────
router.get('/my-tasks', authenticate, async (req, res) => {
  try {
    const tasks = await Task.find({ assignedTo: req.user.id })
      .sort({ dueDate: 1, createdAt: -1 })
      .lean();
    return res.json(tasks);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── GET /api/tasks — list tasks based on role ─────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === 'labor') {
      filter.assignedTo = req.user.id;
    } else if (req.user.role === 'owner' || req.user.role === 'office_manager' || req.user.role === 'admin') {
      // Read all tasks — no filter
    }

    const tasks = await Task.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    return res.json(tasks);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── GET /api/tasks/:id ────────────────────────────────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).lean();
    if (!task) return res.status(404).json({ message: 'Task not found.' });

    // Laborer can only view their own task
    if (req.user.role === 'labor' && String(task.assignedTo) !== String(req.user.id))
      return res.status(403).json({ message: 'Access denied.' });

    return res.json(task);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── POST /api/tasks — owner / office_manager / admin / farmer creates a task ───
router.post('/', authenticate, authorize('owner', 'office_manager', 'admin'), [
  body('title').trim().notEmpty().withMessage('Title is required.').isLength({ max: 120 }),
  body('description').optional({ checkFalsy: true }).trim().isLength({ max: 500 }),
  body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Priority must be low, medium or high.'),
  body('zone').optional({ checkFalsy: true }).trim().isLength({ max: 60 }),
  body('dueDate').optional({ checkFalsy: true }).isISO8601().withMessage('dueDate must be a valid date.'),
  body('assignedTo').optional({ checkFalsy: true }).isMongoId().withMessage('assignedTo must be a valid user ID.'),
  body('assignedToName').optional({ checkFalsy: true }).trim().isLength({ max: 80 }),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const { title, description, priority, zone, dueDate, assignedTo, assignedToName } = req.body;

    const task = await Task.create({
      title,
      description:    description || '',
      priority:       priority    || 'medium',
      zone:           zone        || '',
      dueDate:        dueDate     || null,
      assignedTo:     assignedTo  || null,
      assignedToName: assignedToName || '',
      assignedBy:     req.user.id,
      assignedByName: req.user.name,
    });

    await History.create({
      event:    'Task Created',
      userName: req.user.name,
      zoneName: zone || '—',
      details:  `"${title}" assigned to ${assignedToName || 'unassigned'} [${priority || 'medium'}]`,
      type:     'info',
    });

    return res.status(201).json(task);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── PUT /api/tasks/:id — owner / office_manager / admin / farmer edits task ───
router.put('/:id', authenticate, authorize('owner', 'office_manager', 'admin'), [
  body('title').optional().trim().isLength({ min: 1, max: 120 }),
  body('description').optional({ checkFalsy: true }).trim().isLength({ max: 500 }),
  body('priority').optional().isIn(['low', 'medium', 'high']),
  body('zone').optional({ checkFalsy: true }).trim().isLength({ max: 60 }),
  body('dueDate').optional({ checkFalsy: true }).isISO8601(),
  body('assignedTo').optional({ checkFalsy: true }).isMongoId(),
  body('assignedToName').optional({ checkFalsy: true }).trim().isLength({ max: 80 }),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const { title, description, priority, zone, dueDate, assignedTo, assignedToName } = req.body;
    const updates = {};
    if (title          !== undefined) updates.title          = title;
    if (description    !== undefined) updates.description    = description;
    if (priority       !== undefined) updates.priority       = priority;
    if (zone           !== undefined) updates.zone           = zone;
    if (dueDate        !== undefined) updates.dueDate        = dueDate || null;
    if (assignedTo     !== undefined) updates.assignedTo     = assignedTo || null;
    if (assignedToName !== undefined) updates.assignedToName = assignedToName;

    const task = await Task.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!task) return res.status(404).json({ message: 'Task not found.' });

    return res.json(task);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/tasks/:id/status — laborer advances their own task status ──────
router.patch('/:id/status', authenticate, [
  body('status').isIn(LABORER_VALID_STATUSES).withMessage('Invalid status.'),
  body('report').optional({ checkFalsy: true }).trim().isLength({ max: 1000 }),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found.' });

    // Only the assigned laborer (or manager) can update status
    if (req.user.role === 'labor' && String(task.assignedTo) !== String(req.user.id))
      return res.status(403).json({ message: 'You can only update tasks assigned to you.' });

    const { status, report } = req.body;

    // Enforce forward-only status flow for laborers
    if (req.user.role === 'labor') {
      const expected = STATUS_FLOW[task.status];
      if (status !== expected && status !== 'unable_to_complete')
        return res.status(400).json({ message: `Cannot change status from "${task.status}" to "${status}". Expected: "${expected}".` });
    }

    const updates = { status };
    if (report) updates.report = report;
    if (status === 'completed' || status === 'unable_to_complete') {
      updates.completedAt = new Date();
      updates.isOverdue   = false;   // completed tasks are NEVER overdue
    }

    const updated = await Task.findByIdAndUpdate(req.params.id, updates, { new: true });

    await History.create({
      event:    status === 'completed' ? 'Task Completed' : status === 'unable_to_complete' ? 'Task Unable to Complete' : 'Task In Progress',
      userName: req.user.name,
      zoneName: task.zone || '—',
      details:  `"${task.title}" → ${status}${report ? ` | ${report.substring(0, 80)}` : ''}`,
      type:     status === 'completed' ? 'success' : status === 'unable_to_complete' ? 'warning' : 'info',
    });

    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/tasks/:id/problem-report — laborer reports a problem on a task ─
router.patch('/:id/problem-report', authenticate, [
  body('problemType').isIn(['equipment','sensor','power','crop','water','pipe','pump','other']).withMessage('Invalid problem type.'),
  body('problemReport').trim().notEmpty().withMessage('Problem description is required.').isLength({ max: 800 }),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found.' });

    // Laborer must own the task
    if (req.user.role === 'labor' && String(task.assignedTo) !== String(req.user.id))
      return res.status(403).json({ message: 'You can only report problems on tasks assigned to you.' });

    task.problemType   = req.body.problemType;
    task.problemReport = req.body.problemReport;
    await task.save();

    await History.create({
      event:    'Problem Reported',
      userName: req.user.name,
      zoneName: task.zone || '—',
      details:  `"${task.title}" — ${req.body.problemType}: ${req.body.problemReport.substring(0, 100)}`,
      type:     'warning',
    });

    return res.json({ message: 'Problem report submitted.', task });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/tasks/:id/verify — management verifies completed task ────────
router.patch('/:id/verify', authenticate, authorize('owner', 'office_manager', 'admin'), [
  body('note').optional({ checkFalsy: true }).trim().isLength({ max: 500 }),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found.' });

    task.status           = 'reviewed';
    task.verifiedBy       = req.user.id;
    task.verifiedByName   = req.user.name;
    task.verifiedAt       = new Date();
    task.verificationNote = req.body.note || '';
    await task.save();

    await History.create({
      event:    'Task Reviewed',
      userName: req.user.name,
      zoneName: task.zone || '—',
      details:  `"${task.title}" verified & marked as reviewed by ${req.user.name}`,
      type:     'success',
    });

    return res.json(task);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── DELETE /api/tasks/:id — owner / admin only ────────────────────────────────
router.delete('/:id', authenticate, authorize('owner', 'admin'), async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    return res.status(204).end();
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── Background: mark tasks overdue every 5 minutes ────────────────────────────
// Only marks tasks that are NOT completed/unable_to_complete/reviewed/overdue
setInterval(async () => {
  try {
    const now = new Date();
    await Task.updateMany(
      {
        dueDate:  { $lt: now, $ne: null },
        status:   { $in: ['pending', 'in_progress'] },
        isOverdue: false,
      },
      { $set: { status: 'overdue', isOverdue: true } }
    );
    // Safety net: clear isOverdue on any completed/reviewed tasks
    await Task.updateMany(
      {
        status:    { $in: ['completed', 'unable_to_complete', 'reviewed'] },
        isOverdue: true,
      },
      { $set: { isOverdue: false } }
    );
  } catch (_) {}
}, 5 * 60 * 1000);

module.exports = router;
