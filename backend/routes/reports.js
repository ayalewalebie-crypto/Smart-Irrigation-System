const express    = require('express');
const WaterUsage = require('../models/WaterUsage');
const SensorLog  = require('../models/SensorLog');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// ── GET /api/reports/water?from=&to= ─────────────────────────────────────────

router.get('/water', authenticate, authorize('owner', 'admin', 'office_manager'), async (req, res) => {
  try {
    const { from, to } = req.query;
    const filter = {};
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = from;
      if (to)   filter.date.$lte = to;
    }

    const rows = await WaterUsage.find(filter).sort({ date: 1 }).lean();
    return res.json(rows.map(r => ({
      date:     r.date,
      water:    r.waterLiters,
      moisture: r.avgMoisture,
      events:   r.events,
    })));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── GET /api/reports/sensor-logs?from=&to= ───────────────────────────────────

router.get('/sensor-logs', authenticate, async (req, res) => {
  try {
    const { from, to } = req.query;
    const filter = {};
    if (from || to) {
      filter.recordedAt = {};
      if (from) filter.recordedAt.$gte = new Date(from);
      if (to)   filter.recordedAt.$lte = new Date(to + 'T23:59:59');
    }

    const logs = await SensorLog.find(filter)
      .sort({ recordedAt: -1 })
      .limit(1000)
      .lean();

    return res.json(logs.map(l => {
      let status = 'Normal';
      if (l.temp > 35)       status = 'High';
      else if (l.moisture < 30) status = 'Low';

      return {
        time:     new Date(l.recordedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        sensor:   l.deviceId,
        metric:   'Multi',
        value:    `T:${l.temp}° H:${l.humidity}% M:${l.moisture}%`,
        status,
        temp:     l.temp,
        humidity: l.humidity,
        moisture: l.moisture,
        flow:     l.flow,
        ph:       l.ph,
        light:    l.light,
        pressure: l.pressure,
        recordedAt: l.recordedAt,
      };
    }));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
