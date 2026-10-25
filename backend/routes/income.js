/**
 * Income Routes — farm revenue records in ETB
 *
 * Owner: full CRUD + summary
 * Admin: read + create
 * Office Manager: read only
 *
 * GET    /api/income          — owner/admin/office_manager
 * GET    /api/income/summary  — owner/admin
 * GET    /api/income/:id      — owner/admin/office_manager
 * POST   /api/income          — owner/admin
 * PUT    /api/income/:id      — owner/admin
 * DELETE /api/income/:id      — owner only
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const Income         = require('../models/Income');
const FinancialAudit = require('../models/FinancialAudit');
const History        = require('../models/History');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, authorize('owner', 'admin', 'office_manager'));

function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ message: errors.array().map(e => e.msg).join(' | ') });
    return false;
  }
  return true;
}

async function audit(action, income, user) {
  try {
    await FinancialAudit.create({
      module: 'income', action,
      recordId: income._id, recordTitle: income.title, amount: income.amount,
      performedBy: user.id, performedByName: user.name, performedByRole: user.role,
    });
  } catch (_) {}
}

// ── GET /api/income ────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { source, status, from, to, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (source) filter.source = source;
    if (status) filter.status = status;
    if (from || to) {
      filter.incomeDate = {};
      if (from) filter.incomeDate.$gte = new Date(from);
      if (to)   filter.incomeDate.$lte = new Date(to);
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [records, total] = await Promise.all([
      Income.find(filter).sort({ incomeDate: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      Income.countDocuments(filter),
    ]);
    return res.json({ records, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// ── GET /api/income/summary ────────────────────────────────────────────────────
router.get('/summary', authorize('owner', 'admin'), async (req, res) => {
  try {
    const { from, to } = req.query;
    const filter = { status: 'received' };
    if (from || to) {
      filter.incomeDate = {};
      if (from) filter.incomeDate.$gte = new Date(from);
      if (to)   filter.incomeDate.$lte = new Date(to);
    }
    const records   = await Income.find(filter).lean();
    const total     = records.reduce((s, r) => s + (r.amount || 0), 0);
    const bySource  = {};
    for (const r of records) {
      bySource[r.source] = (bySource[r.source] || 0) + r.amount;
    }
    return res.json({ total, bySource, count: records.length });
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// ── GET /api/income/:id ────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const record = await Income.findById(req.params.id).lean();
    if (!record) return res.status(404).json({ message: 'Income record not found.' });
    return res.json(record);
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// ── POST /api/income ───────────────────────────────────────────────────────────
router.post('/', authorize('owner', 'admin'), [
  body('title').trim().notEmpty().withMessage('Title is required.'),
  body('source').isIn(['crop_sales','livestock','government_grant','consulting','donation','rent','other'])
    .withMessage('Invalid source.'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0.'),
  body('incomeDate').isISO8601().withMessage('Valid income date is required.'),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const data = req.body;
    const record = await Income.create({
      title:         data.title,
      description:   data.description   || '',
      source:        data.source,
      amount:        parseFloat(data.amount),
      incomeDate:    new Date(data.incomeDate),
      cropType:      data.cropType      || '',
      quantity:      data.quantity      || 0,
      unit:          data.unit          || '',
      customer:      data.customer      || '',
      invoiceNo:     data.invoiceNo     || '',
      receiptRef:    data.receiptRef    || '',
      paymentMethod: data.paymentMethod || 'cash',
      status:        data.status        || 'received',
      notes:         data.notes         || '',
      recordedBy:    req.user.id,
      recordedByName: req.user.name,
    });
    await audit('created', record, req.user);
    await History.create({
      event: 'Income Recorded', userName: req.user.name,
      details: `"${data.title}" — ${parseFloat(data.amount).toLocaleString('en-ET')} ETB (${data.source})`,
      type: 'success',
    });
    return res.status(201).json(record);
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// ── PUT /api/income/:id ────────────────────────────────────────────────────────
router.put('/:id', authorize('owner', 'admin'), [
  body('amount').optional().isFloat({ min: 0.01 }),
  body('incomeDate').optional().isISO8601(),
], async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const record = await Income.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Income record not found.' });
    const fields = ['title','description','source','amount','incomeDate','cropType','quantity','unit','customer','invoiceNo','receiptRef','paymentMethod','status','notes'];
    for (const f of fields) {
      if (req.body[f] !== undefined) record[f] = req.body[f];
    }
    await record.save();
    await audit('updated', record, req.user);
    return res.json(record);
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// ── DELETE /api/income/:id ─────────────────────────────────────────────────────
router.delete('/:id', authorize('owner'), async (req, res) => {
  try {
    const record = await Income.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ message: 'Income record not found.' });
    await audit('deleted', record, req.user);
    return res.status(204).end();
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

module.exports = router;
