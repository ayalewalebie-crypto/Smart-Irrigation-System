const express     = require('express');
const { body, param, query, validationResult } = require('express-validator');
const Zone        = require('../models/Zone');
const Sensor      = require('../models/Sensor');
const History     = require('../models/History');
const WaterUsage  = require('../models/WaterUsage');
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

// ── DELETE /api/zones/all — admin wipes all zones ─────────────────────────────
router.delete('/all', authenticate, authorize('admin'), async (req, res) => {
  try {
    await Zone.deleteMany({});
    return res.json({ message: 'All zones deleted.' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── GET /api/zones ────────────────────────────────────────────────────────────

router.get('/', authenticate, async (req, res) => {
  try {
    const zones = await Zone.find().sort({ createdAt: 1 }).lean();

    // Enrich each zone with live average moisture from its online sensors
    const enriched = await Promise.all(zones.map(async (z) => {
      const sensors = await Sensor.find({
        zoneName: z.name,
        online: true,
      }).lean();

      const moisture = sensors.length
        ? Math.round(sensors.reduce((a, s) => a + (s.reading?.moisture ?? 0), 0) / sensors.length)
        : 0;

      return { ...z, id: z._id, moisture };
    }));

    return res.json(enriched);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── POST /api/zones ───────────────────────────────────────────────────────────

router.post('/', authenticate, authorize('owner', 'admin'), [
  body('name').trim().notEmpty().withMessage('Zone name is required.').isLength({ max: 60 }).withMessage('Name too long.'),
  body('crop').optional({ checkFalsy: true }).trim().isLength({ max: 60 }).withMessage('Crop name too long.'),
  body('area').optional().isFloat({ min: 0, max: 100000 }).withMessage('Area must be a positive number.'),
  body('duration').optional().isInt({ min: 1, max: 1440 }).withMessage('Duration must be 1–1440 minutes.'),
  body('schedule').optional({ checkFalsy: true }).trim().matches(/^\d{2}:\d{2}$/).withMessage('Schedule must be HH:MM format.'),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const { name, crop, area, duration, schedule } = req.body;
    if (!name) return res.status(400).json({ message: 'Zone name is required.' });

    const zone = await Zone.create({ name, crop, area, duration, schedule });

    await History.create({
      event: 'Farm Added', userName: req.user.name,
      zoneName: name,
      details: `New farm: ${name} (${area || 1} ha)`,
      type: 'success',
    });

    return res.status(201).json({ ...zone.toJSON(), moisture: 0 });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── PUT /api/zones/:id ────────────────────────────────────────────────────────

router.put('/:id', authenticate, authorize('owner', 'admin'), [
  body('name').optional().trim().isLength({ min: 1, max: 60 }).withMessage('Name must be 1–60 characters.'),
  body('crop').optional({ checkFalsy: true }).trim().isLength({ max: 60 }).withMessage('Crop name too long.'),
  body('area').optional().isFloat({ min: 0, max: 100000 }).withMessage('Area must be a positive number.'),
  body('duration').optional().isInt({ min: 1, max: 1440 }).withMessage('Duration must be 1–1440 minutes.'),
  body('schedule').optional({ checkFalsy: true }).trim().matches(/^\d{2}:\d{2}$/).withMessage('Schedule must be HH:MM format.'),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const zone = await Zone.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!zone) return res.status(404).json({ message: 'Zone not found.' });
    return res.json({ ...zone.toJSON(), moisture: 0 });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── DELETE /api/zones/:id ─────────────────────────────────────────────────────

router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const zone = await Zone.findByIdAndDelete(req.params.id);
    if (!zone) return res.status(404).json({ message: 'Zone not found.' });

    await History.create({
      event: 'Farm Deleted', userName: req.user.name,
      zoneName: zone.name,
      details: `Farm "${zone.name}" was removed`,
      type: 'warning',
    });

    return res.status(204).end();
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── POST /api/zones/:id/irrigate  { action: 'start' | 'stop' } ───────────────

router.post('/:id/irrigate', authenticate, authorize('owner', 'admin'), async (req, res) => {
  try {
    const { action } = req.body;
    if (!['start', 'stop'].includes(action))
      return res.status(400).json({ message: 'action must be "start" or "stop".' });

    const zone = await Zone.findByIdAndUpdate(
      req.params.id,
      { active: action === 'start' },
      { new: true }
    );
    if (!zone) return res.status(404).json({ message: 'Zone not found.' });

    await History.create({
      event:    action === 'start' ? 'Farm Irrigation Started' : 'Farm Irrigation Stopped',
      userName: req.user.name,
      zoneName: zone.name,
      details:  `${action === 'start' ? 'Manual start' : 'Manually stopped'} — ${zone.duration} min`,
      type:     action === 'start' ? 'info' : 'success',
    });

    // Increment today's irrigation event count in WaterUsage
    const today = new Date().toISOString().split('T')[0];
    await WaterUsage.findOneAndUpdate(
      { date: today },
      { $inc: { events: 1 } },
      { upsert: true }
    );

    return res.json({ zoneId: zone._id, action, active: zone.active });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── POST /api/zones/irrigate-all  { action: 'start' | 'stop' } ───────────────

router.post('/irrigate-all', authenticate, authorize('owner', 'admin'), async (req, res) => {
  try {
    const { action } = req.body;
    if (!['start', 'stop'].includes(action))
      return res.status(400).json({ message: 'action must be "start" or "stop".' });

    await Zone.updateMany({}, { active: action === 'start' });

    await History.create({
      event:    action === 'start' ? 'All Farms Started' : 'All Farms Stopped',
      userName: req.user.name,
      details:  `All farms ${action === 'start' ? 'started' : 'stopped'} by ${req.user.name}`,
      type:     action === 'start' ? 'info' : 'success',
    });

    return res.json({ action, active: action === 'start' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
