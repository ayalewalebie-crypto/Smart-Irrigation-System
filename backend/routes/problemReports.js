/**
 * Problem Reports Route
 *
 * Laborer     : create own reports, view own reports
 * Office Mgr  : view all reports, update status (open → in_review)
 * Owner/Admin : full access — view all, update status, resolve
 */
const express = require('express');
const { body, validationResult } = require('express-validator');
const ProblemReport = require('../models/ProblemReport');
const History       = require('../models/History');
const { authenticate, requirePasswordChange, authorize } = require('../middleware/auth');

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

// ── GET /api/problem-reports ──────────────────────────────────────────────────
// Laborer: own reports only. Others: all (with optional filters).
router.get('/', async (req, res) => {
  try {
    const filter = {};

    // Laborers can only see their own reports
    if (req.user.role === 'labor') {
      filter.reportedBy = req.user.id;
    } else {
      // Optional filters for managers
      if (req.query.status)       filter.status       = req.query.status;
      if (req.query.problemType)  filter.problemType  = req.query.problemType;
      if (req.query.priority)     filter.priority     = req.query.priority;
      if (req.query.reportedBy)   filter.reportedBy   = req.query.reportedBy;
    }

    const page  = parseInt(req.query.page  || 1);
    const limit = parseInt(req.query.limit || 50);
    const skip  = (page - 1) * limit;

    const [reports, total] = await Promise.all([
      ProblemReport.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ProblemReport.countDocuments(filter),
    ]);

    return res.json({ reports, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── GET /api/problem-reports/:id ──────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const report = await ProblemReport.findById(req.params.id).lean();
    if (!report) return res.status(404).json({ message: 'Report not found.' });

    // Labor can only read own report
    if (req.user.role === 'labor' && String(report.reportedBy) !== String(req.user.id))
      return res.status(403).json({ message: 'Access denied.' });

    return res.json(report);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── POST /api/problem-reports ─────────────────────────────────────────────────
router.post('/', [
  body('problemType').isIn(['pump','pipe_leakage','low_water','sensor','irrigation_not_working','equipment','crop','power','other'])
    .withMessage('Invalid problem type.'),
  body('description').trim().notEmpty().withMessage('Description is required.').isLength({ max: 1000 }),
  body('farm').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  body('field').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
  body('priority').optional().isIn(['low','medium','high','urgent']).withMessage('Invalid priority.'),
  body('imageUrl').optional({ checkFalsy: true }).trim().isLength({ max: 5000 }),
  body('taskId').optional({ checkFalsy: true }).isMongoId(),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const { problemType, description, farm, field, priority, imageUrl, taskId } = req.body;

    const report = await ProblemReport.create({
      reportedBy:     req.user.id,
      reportedByName: req.user.name,
      problemType,
      description,
      farm:      farm      || '',
      field:     field     || '',
      priority:  priority  || 'medium',
      imageUrl:  imageUrl  || '',
      taskId:    taskId    || null,
      status:    'open',
    });

    await History.create({
      event:    'Problem Report Submitted',
      userName: req.user.name,
      zoneName: farm || '—',
      details:  `${problemType}: ${description.substring(0, 100)}`,
      type:     'warning',
    }).catch(() => {});

    return res.status(201).json(report);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/problem-reports/:id/status ─────────────────────────────────────
// Office manager: open → in_review. Owner/Admin: any transition incl. resolved.
router.patch('/:id/status', authorize('owner', 'admin', 'office_manager'), [
  body('status').isIn(['open','in_review','resolved']).withMessage('Invalid status.'),
  body('resolution').optional({ checkFalsy: true }).trim().isLength({ max: 500 }),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const report = await ProblemReport.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Report not found.' });

    // Office manager can only set in_review, not resolve
    if (req.user.role === 'office_manager' && req.body.status === 'resolved')
      return res.status(403).json({ message: 'Only owner or admin can mark a report as resolved.' });

    report.status = req.body.status;
    if (req.body.status === 'resolved') {
      report.resolvedBy     = req.user.id;
      report.resolvedByName = req.user.name;
      report.resolvedAt     = new Date();
      report.resolution     = req.body.resolution || '';
    }
    await report.save();

    await History.create({
      event:    `Problem Report ${req.body.status === 'resolved' ? 'Resolved' : 'Under Review'}`,
      userName: req.user.name,
      zoneName: report.farm || '—',
      details:  `Report by ${report.reportedByName} — ${report.problemType}`,
      type:     req.body.status === 'resolved' ? 'success' : 'info',
    }).catch(() => {});

    return res.json(report);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── DELETE /api/problem-reports/:id — owner/admin only ───────────────────────
router.delete('/:id', authorize('owner', 'admin'), async (req, res) => {
  try {
    const report = await ProblemReport.findByIdAndDelete(req.params.id);
    if (!report) return res.status(404).json({ message: 'Report not found.' });
    return res.status(204).end();
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
