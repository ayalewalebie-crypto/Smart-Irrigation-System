const express = require('express');
const { body, query, validationResult } = require('express-validator');
const History = require('../models/History');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ message: errors.array().map(e => e.msg).join(' | ') });
    return false;
  }
  return true;
}

const VALID_TYPES = ['info', 'success', 'warning', 'danger'];

// ── GET /api/history?from=&to=&type=&limit= ───────────────────────────────────
router.get('/', authenticate, [
  query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('limit must be 1–500.'),
  query('type').optional().isIn([...VALID_TYPES, 'all']).withMessage('Invalid type filter.'),
  query('from').optional().isISO8601().withMessage('from must be a valid date.'),
  query('to').optional().isISO8601().withMessage('to must be a valid date.'),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const { from, to, type, limit = 200 } = req.query;
    const filter = {};

    if (from || to) {
      filter.recordedAt = {};
      if (from) filter.recordedAt.$gte = new Date(from);
      if (to)   filter.recordedAt.$lte = new Date(to + 'T23:59:59');
    }
    if (type && type !== 'all') filter.type = type;

    const events = await History.find(filter)
      .sort({ recordedAt: -1 })
      .limit(Number(limit))
      .lean();

    return res.json(events.map(e => ({
      id:      e._id,
      event:   e.event,
      user:    e.userName,
      zone:    e.zoneName,
      details: e.details,
      type:    e.type,
      date:    new Date(e.recordedAt).toISOString().split('T')[0],
      time:    new Date(e.recordedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      recordedAt: e.recordedAt,
    })));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── POST /api/history — log a custom event ────────────────────────────────────
router.post('/', authenticate, [
  body('event').trim().notEmpty().withMessage('event is required.').isLength({ max: 120 }).withMessage('event too long.'),
  body('zone').optional({ checkFalsy: true }).trim().isLength({ max: 60 }).withMessage('zone name too long.'),
  body('details').optional({ checkFalsy: true }).trim().isLength({ max: 255 }).withMessage('details too long.'),
  body('type').optional().isIn(VALID_TYPES).withMessage(`type must be one of: ${VALID_TYPES.join(', ')}.`),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const { event, zone, details, type } = req.body;

    const doc = await History.create({
      event,
      userName: req.user?.name || 'System',
      zoneName: zone    || '—',
      details:  details || '',
      type:     type    || 'info',
    });

    return res.status(201).json({ id: doc._id });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── DELETE /api/history/:id — owner only ─────────────────────────────────────
router.delete('/:id', authenticate, async (req, res) => {
  try {
    if (!['owner', 'admin'].includes(req.user.role))
      return res.status(403).json({ message: 'Only Owner or Admin can delete history records.' });
    const doc = await History.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Record not found.' });
    return res.status(204).end();
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── DELETE /api/history — clear all (owner only) ──────────────────────────────
router.delete('/', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'owner')
      return res.status(403).json({ message: 'Only the Owner can clear all history.' });
    await History.deleteMany({});
    return res.status(204).end();
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
