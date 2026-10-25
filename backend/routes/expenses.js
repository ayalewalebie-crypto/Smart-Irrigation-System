/**
 * Expense Routes — ETB expense management with approval workflow
 *
 * Owner:          full access — approve/reject/mark paid, view all
 * Admin:          view all, approve expenses within limit, submit to owner
 * Office Manager: create/submit expenses, view all
 *
 * GET    /api/expenses              — owner/admin/office_manager
 * GET    /api/expenses/summary      — owner/admin
 * GET    /api/expenses/:id          — owner/admin/office_manager
 * POST   /api/expenses              — owner/admin/office_manager
 * PUT    /api/expenses/:id          — owner/admin/office_manager (draft only)
 * PATCH  /api/expenses/:id/submit   — office_manager/admin
 * PATCH  /api/expenses/:id/approve  — owner/admin
 * PATCH  /api/expenses/:id/reject   — owner/admin
 * PATCH  /api/expenses/:id/pay      — owner/admin
 * DELETE /api/expenses/:id          — owner only
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const Expense        = require('../models/Expense');
const Budget         = require('../models/Budget');
const FinancialAudit = require('../models/FinancialAudit');
const History        = require('../models/History');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, authorize('owner', 'admin', 'office_manager'));

// Amount requiring owner approval (50,000 ETB)
const OWNER_APPROVAL_THRESHOLD = 50000;

function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ message: errors.array().map(e => e.msg).join(' | ') });
    return false;
  }
  return true;
}

async function audit(action, expense, user, notes = '') {
  try {
    await FinancialAudit.create({
      module: 'expense', action,
      recordId: expense._id, recordTitle: expense.title, amount: expense.amount,
      performedBy: user.id, performedByName: user.name, performedByRole: user.role,
      notes,
    });
  } catch (_) {}
}

// ── GET /api/expenses ──────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { status, category, from, to, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (status)   filter.status   = status;
    if (category) filter.category = category;
    if (from || to) {
      filter.expenseDate = {};
      if (from) filter.expenseDate.$gte = new Date(from);
      if (to)   filter.expenseDate.$lte = new Date(to);
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [expenses, total] = await Promise.all([
      Expense.find(filter).sort({ expenseDate: -1, createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      Expense.countDocuments(filter),
    ]);

    // Fetch active budget for budget utilization info
    const now = new Date();
    const activeBudget = await Budget.findOne({ status: 'active', year: now.getFullYear() })
      .select('title totalBudget categories').lean();

    return res.json({ expenses, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)), activeBudget: activeBudget || null });
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// ── GET /api/expenses/summary ──────────────────────────────────────────────────
router.get('/summary', async (req, res) => {
  try {
    const { from, to } = req.query;
    const filter = {};
    if (from || to) {
      filter.expenseDate = {};
      if (from) filter.expenseDate.$gte = new Date(from);
      if (to)   filter.expenseDate.$lte = new Date(to);
    }

    const expenses = await Expense.find(filter).lean();
    const totalAmount = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const byStatus    = {};
    const byCategory  = {};

    for (const e of expenses) {
      byStatus[e.status]     = (byStatus[e.status]     || 0) + e.amount;
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
    }

    const pending  = expenses.filter(e => ['draft','submitted'].includes(e.status)).reduce((s,e) => s+e.amount, 0);
    const approved = expenses.filter(e => e.status === 'approved').reduce((s,e) => s+e.amount, 0);
    const paid     = expenses.filter(e => e.status === 'paid').reduce((s,e) => s+e.amount, 0);

    return res.json({ totalAmount, pending, approved, paid, byStatus, byCategory, count: expenses.length });
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// ── GET /api/expenses/:id ──────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id).lean();
    if (!expense) return res.status(404).json({ message: 'Expense not found.' });
    return res.json(expense);
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// ── POST /api/expenses ─────────────────────────────────────────────────────────
router.post('/', [
  body('title').trim().notEmpty().withMessage('Title is required.'),
  body('category').isIn(['salaries','seeds','fertilizer','irrigation','fuel','equipment','maintenance','transport','farm_operations','office','other'])
    .withMessage('Invalid category.'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0.'),
  body('expenseDate').isISO8601().withMessage('Valid expense date is required.'),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const { title, description, category, amount, expenseDate, budgetId, vendor, invoiceNo, receiptRef, notes } = req.body;

    // Auto-link to active budget if no budgetId provided
    let resolvedBudgetId = budgetId || null;
    if (!resolvedBudgetId) {
      const expDate = new Date(expenseDate);
      const activeBudget = await Budget.findOne({
        status: 'active',
        year:   expDate.getFullYear(),
      }).lean();
      if (activeBudget) resolvedBudgetId = activeBudget._id;
    }

    const expense = await Expense.create({
      title, description: description || '', category,
      amount: parseFloat(amount), expenseDate: new Date(expenseDate),
      budgetId: resolvedBudgetId, vendor: vendor || '', invoiceNo: invoiceNo || '',
      receiptRef: receiptRef || '',
      requiresOwnerApproval: parseFloat(amount) >= OWNER_APPROVAL_THRESHOLD,
      notes: notes || '',
      status: 'draft',
      createdBy: req.user.id, createdByName: req.user.name,
    });
    await audit('created', expense, req.user);
    await History.create({
      event: 'Expense Created', userName: req.user.name,
      details: `"${title}" — ${parseFloat(amount).toLocaleString('en-ET')} ETB (${category})`,
      type: 'info',
    });
    return res.status(201).json(expense);
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// ── PUT /api/expenses/:id ──────────────────────────────────────────────────────
router.put('/:id', [
  body('amount').optional().isFloat({ min: 0.01 }),
  body('expenseDate').optional().isISO8601(),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ message: 'Expense not found.' });
    if (!['draft'].includes(expense.status) && req.user.role !== 'owner')
      return res.status(400).json({ message: 'Only draft expenses can be edited.' });

    const fields = ['title','description','category','amount','expenseDate','vendor','invoiceNo','receiptRef','notes'];
    for (const f of fields) {
      if (req.body[f] !== undefined) expense[f] = req.body[f];
    }
    if (expense.amount !== undefined)
      expense.requiresOwnerApproval = expense.amount >= OWNER_APPROVAL_THRESHOLD;

    await expense.save();
    await audit('updated', expense, req.user);
    return res.json(expense);
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// ── PATCH /api/expenses/:id/submit ────────────────────────────────────────────
router.patch('/:id/submit', async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ message: 'Expense not found.' });
    if (expense.status !== 'draft')
      return res.status(400).json({ message: 'Only draft expenses can be submitted.' });

    expense.status      = 'submitted';
    expense.submittedBy = req.user.id;
    expense.submittedAt = new Date();
    await expense.save();
    await audit('submitted', expense, req.user);
    return res.json(expense);
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// ── PATCH /api/expenses/:id/approve ───────────────────────────────────────────
router.patch('/:id/approve', authorize('owner', 'admin'), async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ message: 'Expense not found.' });
    if (expense.status !== 'submitted')
      return res.status(400).json({ message: 'Only submitted expenses can be approved.' });

    // Large expenses need owner approval
    if (expense.requiresOwnerApproval && req.user.role !== 'owner')
      return res.status(403).json({ message: `Expenses over ${OWNER_APPROVAL_THRESHOLD.toLocaleString()} ETB require Owner approval.` });

    expense.status      = 'approved';
    expense.approvedBy  = req.user.id;
    expense.approvedByName = req.user.name;
    expense.approvedAt  = new Date();
    await expense.save();

    // Update budget category usage if linked
    if (expense.budgetId) {
      await Budget.updateOne(
        { _id: expense.budgetId, 'categories.name': expense.category },
        { $inc: { 'categories.$.used': expense.amount } }
      );
    }

    await audit('approved', expense, req.user);
    await History.create({
      event: 'Expense Approved', userName: req.user.name,
      details: `"${expense.title}" — ${expense.amount.toLocaleString('en-ET')} ETB approved`,
      type: 'success',
    });
    return res.json(expense);
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// ── PATCH /api/expenses/:id/reject ────────────────────────────────────────────
router.patch('/:id/reject', authorize('owner', 'admin'), [
  body('reason').trim().notEmpty().withMessage('Rejection reason is required.'),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ message: 'Expense not found.' });
    if (!['submitted','approved'].includes(expense.status))
      return res.status(400).json({ message: 'Cannot reject this expense.' });

    expense.status           = 'rejected';
    expense.rejectionReason  = req.body.reason;
    await expense.save();
    await audit('rejected', expense, req.user, req.body.reason);
    return res.json(expense);
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// ── PATCH /api/expenses/:id/pay ───────────────────────────────────────────────
router.patch('/:id/pay', authorize('owner', 'admin'), [
  body('paymentRef').optional().trim(),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ message: 'Expense not found.' });
    if (expense.status !== 'approved')
      return res.status(400).json({ message: 'Only approved expenses can be marked as paid.' });

    expense.status     = 'paid';
    expense.paidBy     = req.user.id;
    expense.paidAt     = new Date();
    expense.paymentRef = req.body.paymentRef || '';
    await expense.save();
    await audit('paid', expense, req.user, req.body.paymentRef || '');
    return res.json(expense);
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// ── DELETE /api/expenses/:id ───────────────────────────────────────────────────
router.delete('/:id', authorize('owner'), async (req, res) => {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);
    if (!expense) return res.status(404).json({ message: 'Expense not found.' });
    await audit('deleted', expense, req.user);
    return res.status(204).end();
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

module.exports = router;
