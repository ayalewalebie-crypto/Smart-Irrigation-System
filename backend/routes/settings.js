const express  = require('express');
const Settings = require('../models/Settings');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ── GET /api/settings ─────────────────────────────────────────────────────────

router.get('/', authenticate, async (req, res) => {
  try {
    // Find or auto-create settings for this user
    let settings = await Settings.findOne({ userId: req.user.id });
    if (!settings) {
      settings = await Settings.create({ userId: req.user.id });
    }
    return res.json({
      timezone:          settings.timezone,
      units:             settings.units,
      emailAlerts:       settings.emailAlerts,
      smsAlerts:         settings.smsAlerts,
      moistureThreshold: settings.moistureThreshold,
      tempThreshold:     settings.tempThreshold,
      autoIrrigate:      settings.autoIrrigate,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

// ── PUT /api/settings ─────────────────────────────────────────────────────────

router.put('/', authenticate, async (req, res) => {
  try {
    const {
      timezone, units, emailAlerts, smsAlerts,
      moistureThreshold, tempThreshold, autoIrrigate,
    } = req.body;

    const updates = {};
    if (timezone           !== undefined) updates.timezone           = timezone;
    if (units              !== undefined) updates.units              = units;
    if (emailAlerts        !== undefined) updates.emailAlerts        = emailAlerts;
    if (smsAlerts          !== undefined) updates.smsAlerts          = smsAlerts;
    if (moistureThreshold  !== undefined) updates.moistureThreshold  = moistureThreshold;
    if (tempThreshold      !== undefined) updates.tempThreshold      = tempThreshold;
    if (autoIrrigate       !== undefined) updates.autoIrrigate       = autoIrrigate;

    const settings = await Settings.findOneAndUpdate(
      { userId: req.user.id },
      { $set: updates },
      { new: true, upsert: true }
    );

    return res.json({
      timezone:          settings.timezone,
      units:             settings.units,
      emailAlerts:       settings.emailAlerts,
      smsAlerts:         settings.smsAlerts,
      moistureThreshold: settings.moistureThreshold,
      tempThreshold:     settings.tempThreshold,
      autoIrrigate:      settings.autoIrrigate,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
