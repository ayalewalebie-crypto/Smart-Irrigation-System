/**
 * Budget Routes — ETB budget management
 *
 * Owner:          full CRUD, approve/activate budgets
 * Admin:          read, view utilization
 * Office Manager: read only
 *
 * GET    /api/budget              — owner/admin/office_manager
 * GET    /api/budget/summary      — owner/admin: totals & utilization
 * GET    /api/budget/:id          — owner/admin/office_manager
 * POST   /api/budget              — owner only
 * PUT    /api/budget/:id          — owner only
 * PATCH  /api/budget/:id/approve  — owner only
 * PATCH  /api/budget/:id/use      — owner/admin/office_manager (record spend)
 * DELETE /api/budget/:id          — owner only
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const Budget         = require('../models/Budget');
const FinancialAudit = require('../models/FinancialAudit');
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

async function audit(module, action, recordId, recordTitle, amount, user, notes = '') {
  try {
    await FinancialAudit.create({
      module, action, recordId, recordTitle, amount,
      performedBy: user.id, performedByName: user.name, performedByRole: user.role,
      notes,
    });
  } catch (_) { /* non-blocking */ }
}

// ── GET /api/budget ────────────────────────────────────────────────────────────
router.get('/', authorize('owner', 'admin', 'office_manager'), async (req, res) => {
  try {
    const { type, year, status } = req.query;
    const filter = {};
    if (type)   filter.type   = type;
    if (year)   filter.year   = parseInt(year);
    if (status) filter.status = status;

    const budgets = await Budget.find(filter).sort({ year: -1, month: -1, createdAt: -1 }).lean();
    return res.json(budgets);
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// ── GET /api/budget/summary ────────────────────────────────────────────────────
router.get('/summary', authorize('owner', 'admin', 'office_manager'), async (req, res) => {
  try {
    const { year } = req.query;
    const filter = { status: 'active' };
    if (year) filter.year = parseInt(year);

    const budgets = await Budget.find(filter).lean();
    const totalBudget    = budgets.reduce((s, b) => s + (b.totalBudget || 0), 0);
    const totalAllocated = budgets.reduce((s, b) => s + b.categories.reduce((a, c) => a + (c.allocated || 0), 0), 0);
    const totalUsed      = budgets.reduce((s, b) => s + b.categories.reduce((a, c) => a + (c.used || 0), 0), 0);
    const remaining      = totalBudget - totalUsed;
    const utilizationPct = totalBudget > 0 ? +((totalUsed / totalBudget) * 100).toFixed(1) : 0;

    // Aggregate by category
    const catMap = {};
    for (const b of budgets) {
      for (const c of b.categories) {
        if (!catMap[c.name]) catMap[c.name] = { name: c.name, label: c.label, allocated: 0, used: 0 };
        catMap[c.name].allocated += c.allocated || 0;
        catMap[c.name].used      += c.used      || 0;
      }
    }

    return res.json({
      totalBudget, totalAllocated, totalUsed, remaining, utilizationPct,
      categories: Object.values(catMap),
      budgetCount: budgets.length,
    });
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// ── GET /api/budget/:id ────────────────────────────────────────────────────────
router.get('/:id', authorize('owner', 'admin', 'office_manager'), async (req, res) => {
  try {
    const budget = await Budget.findById(req.params.id).lean();
    if (!budget) return res.status(404).json({ message: 'Budget not found.' });
    return res.json(budget);
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// ── POST /api/budget ───────────────────────────────────────────────────────────
router.post('/', authorize('owner'), [
  body('title').trim().notEmpty().withMessage('Title is required.'),
  body('type').isIn(['annual','seasonal','monthly']).withMessage('Type must be annual, seasonal or monthly.'),
  body('year').isInt({ min: 2000, max: 2100 }).withMessage('Year is required.'),
  body('totalBudget').isFloat({ min: 0 }).withMessage('Total budget must be a positive number.'),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const { title, type, year, month, season, totalBudget, categories, notes } = req.body;
    const budget = await Budget.create({
      title, type, year,
      month:    month    || null,
      season:   season   || '',
      totalBudget,
      categories: categories || undefined,
      notes:    notes    || '',
      status:   'draft',
      createdBy: req.user.id,
    });
    await audit('budget', 'created', budget._id, title, totalBudget, req.user);
    return res.status(201).json(budget);
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// ── PUT /api/budget/:id ────────────────────────────────────────────────────────
router.put('/:id', authorize('owner'), [
  body('totalBudget').optional().isFloat({ min: 0 }),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const { title, type, year, month, season, totalBudget, categories, notes, status } = req.body;
    const budget = await Budget.findById(req.params.id);
    if (!budget) return res.status(404).json({ message: 'Budget not found.' });

    if (title        !== undefined) budget.title        = title;
    if (type         !== undefined) budget.type         = type;
    if (year         !== undefined) budget.year         = year;
    if (month        !== undefined) budget.month        = month;
    if (season       !== undefined) budget.season       = season;
    if (totalBudget  !== undefined) budget.totalBudget  = totalBudget;
    if (categories   !== undefined) budget.categories   = categories;
    if (notes        !== undefined) budget.notes        = notes;
    if (status       !== undefined) budget.status       = status;

    await budget.save();
    await audit('budget', 'updated', budget._id, budget.title, budget.totalBudget, req.user);
    return res.json(budget);
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// ── PATCH /api/budget/:id/approve ─────────────────────────────────────────────
router.patch('/:id/approve', authorize('owner'), async (req, res) => {
  try {
    const budget = await Budget.findById(req.params.id);
    if (!budget) return res.status(404).json({ message: 'Budget not found.' });

    budget.status     = 'active';
    budget.approvedBy = req.user.id;
    budget.approvedAt = new Date();
    await budget.save();
    await audit('budget', 'approved', budget._id, budget.title, budget.totalBudget, req.user);
    return res.json({ message: 'Budget approved and activated.', budget });
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// ── PATCH /api/budget/:id/use ─────────────────────────────────────────────────
// Record actual spending against a budget category
router.patch('/:id/use', authorize('owner', 'admin', 'office_manager'), [
  body('categoryName').trim().notEmpty().withMessage('Category name is required.'),
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be positive.'),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const { categoryName, amount } = req.body;
    const budget = await Budget.findById(req.params.id);
    if (!budget) return res.status(404).json({ message: 'Budget not found.' });

    const cat = budget.categories.find(c => c.name === categoryName);
    if (!cat) return res.status(400).json({ message: `Category "${categoryName}" not found in this budget.` });

    cat.used = (cat.used || 0) + parseFloat(amount);
    await budget.save();
    return res.json(budget);
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// ── DELETE /api/budget/:id ─────────────────────────────────────────────────────
router.delete('/:id', authorize('owner'), async (req, res) => {
  try {
    const budget = await Budget.findByIdAndDelete(req.params.id);
    if (!budget) return res.status(404).json({ message: 'Budget not found.' });
    await audit('budget', 'deleted', budget._id, budget.title, budget.totalBudget, req.user);
    return res.status(204).end();
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

module.exports = router;
