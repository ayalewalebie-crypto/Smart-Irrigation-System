/**
 * Financial Audit Trail Routes
 *
 * Owner only — immutable record of all financial actions
 *
 * GET /api/financial-audit           — paginated audit list
 * GET /api/financial-audit/pl        — profit & loss summary
 */

const express        = require('express');
const FinancialAudit = require('../models/FinancialAudit');
const Expense        = require('../models/Expense');
const Income         = require('../models/Income');
const Payroll        = require('../models/Payroll');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, authorize('owner', 'admin'));

// ── GET /api/financial-audit ───────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { module, action, from, to, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (module) filter.module = module;
    if (action) filter.action = action;
    if (from || to) {
      filter.timestamp = {};
      if (from) filter.timestamp.$gte = new Date(from);
      if (to)   filter.timestamp.$lte = new Date(to);
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [records, total] = await Promise.all([
      FinancialAudit.find(filter).sort({ timestamp: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      FinancialAudit.countDocuments(filter),
    ]);
    return res.json({ records, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// ── GET /api/financial-audit/pl — Profit & Loss summary ───────────────────────
router.get('/pl', async (req, res) => {
  try {
    const { from, to } = req.query;
    const dateFilter = {};
    if (from || to) {
      if (from) dateFilter.$gte = new Date(from);
      if (to)   dateFilter.$lte = new Date(to + 'T23:59:59');
    }
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    const incomeFilter  = { status: 'received', ...(hasDateFilter && { incomeDate: dateFilter }) };
    const expenseFilter = { status: 'paid',     ...(hasDateFilter && { expenseDate: dateFilter }) };
    // FIX: apply date filter to payroll using paidAt field
    const payrollFilter = { status: 'paid',     ...(hasDateFilter && { paidAt: dateFilter }) };

    const [incomeRecs, expenseRecs, payrollRecs] = await Promise.all([
      Income.find(incomeFilter).lean(),
      Expense.find(expenseFilter).lean(),
      Payroll.find(payrollFilter).lean(),
    ]);

    const totalIncome   = incomeRecs.reduce((s, r) => s + (r.amount || 0), 0);
    const totalExpenses = expenseRecs.reduce((s, r) => s + (r.amount || 0), 0);
    const totalPayroll  = payrollRecs.reduce((s, r) => s + (r.netSalary || 0), 0);
    const totalCosts    = totalExpenses + totalPayroll;
    const profitLoss    = totalIncome - totalCosts;
    const margin        = totalIncome > 0 ? +((profitLoss / totalIncome) * 100).toFixed(1) : 0;

    const bySource   = {};
    const byCategory = {};
    for (const r of incomeRecs)  bySource[r.source]     = (bySource[r.source]     || 0) + r.amount;
    for (const r of expenseRecs) byCategory[r.category] = (byCategory[r.category] || 0) + r.amount;

    return res.json({
      totalIncome, totalExpenses, totalPayroll, totalCosts,
      profitLoss, margin, isProfit: profitLoss >= 0,
      bySource, byCategory, currency: 'ETB',
    });
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

// ── GET /api/financial-audit/summary — full financial dashboard metrics ────────
router.get('/summary', async (req, res) => {
  try {
    const now   = new Date();
    const year  = parseInt(req.query.year  || now.getFullYear());
    const month = parseInt(req.query.month || now.getMonth() + 1);

    const yearStart  = new Date(`${year}-01-01`);
    const yearEnd    = new Date(`${year}-12-31T23:59:59`);
    const monthStart = new Date(`${year}-${String(month).padStart(2,'0')}-01`);
    const monthEnd   = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    monthEnd.setDate(0); monthEnd.setHours(23,59,59);

    const [
      annualIncome, annualExpenses, annualPayroll,
      monthlyIncome, monthlyExpenses, monthlyPayroll,
      activeBudgets,
      pendingExpenses, pendingPayrolls,
    ] = await Promise.all([
      Income.find({ status:'received', incomeDate: { $gte: yearStart, $lte: yearEnd }}).lean(),
      Expense.find({ status:'paid', expenseDate: { $gte: yearStart, $lte: yearEnd }}).lean(),
      Payroll.find({ status:'paid', paidAt: { $gte: yearStart, $lte: yearEnd }}).lean(),
      Income.find({ status:'received', incomeDate: { $gte: monthStart, $lte: monthEnd }}).lean(),
      Expense.find({ status:'paid', expenseDate: { $gte: monthStart, $lte: monthEnd }}).lean(),
      Payroll.find({ status:'paid', paidAt: { $gte: monthStart, $lte: monthEnd }}).lean(),
      require('../models/Budget').find({ status: 'active', year }).lean(),
      Expense.countDocuments({ status: 'submitted' }),
      Payroll.countDocuments({ status: 'submitted' }),
    ]);

    const sum = (arr, field) => arr.reduce((s, r) => s + (r[field] || 0), 0);

    // Annual totals
    const annualTotalIncome   = sum(annualIncome,   'amount');
    const annualTotalExpenses = sum(annualExpenses, 'amount');
    const annualTotalPayroll  = sum(annualPayroll,  'netSalary');
    const annualTotalCosts    = annualTotalExpenses + annualTotalPayroll;
    const annualPL            = annualTotalIncome - annualTotalCosts;

    // Monthly totals
    const monthlyTotalIncome   = sum(monthlyIncome,   'amount');
    const monthlyTotalExpenses = sum(monthlyExpenses, 'amount');
    const monthlyTotalPayroll  = sum(monthlyPayroll,  'netSalary');
    const monthlyTotalCosts    = monthlyTotalExpenses + monthlyTotalPayroll;
    const monthlyPL            = monthlyTotalIncome - monthlyTotalCosts;

    // Income by source (annual)
    const incomeBySource = {};
    for (const r of annualIncome) incomeBySource[r.source] = (incomeBySource[r.source] || 0) + r.amount;

    // Expenses by category (annual)
    const expenseByCategory = {};
    for (const r of annualExpenses) expenseByCategory[r.category] = (expenseByCategory[r.category] || 0) + r.amount;

    // Payroll breakdown (annual)
    const payrollBreakdown = {
      grossTotal:     sum(annualPayroll, 'grossSalary'),
      netTotal:       sum(annualPayroll, 'netSalary'),
      taxTotal:       sum(annualPayroll, 'incomeTax'),
      pensionEmpTotal:sum(annualPayroll, 'pensionEmployee'),
      pensionEmpRTotal:sum(annualPayroll,'pensionEmployer'),
      headcount:      new Set(annualPayroll.map(r => String(r.employeeId))).size,
    };

    // Budget vs Actual
    const budgetVsActual = activeBudgets.map(b => ({
      id:           b._id,
      title:        b.title,
      type:         b.type,
      totalBudget:  b.totalBudget,
      totalAllocated: b.categories?.reduce((s, c) => s + (c.allocated || 0), 0) || 0,
      totalUsed:    b.categories?.reduce((s, c) => s + (c.used || 0), 0) || 0,
      remaining:    b.totalBudget - (b.categories?.reduce((s, c) => s + (c.used || 0), 0) || 0),
      revenueTarget: b.revenueTarget || 0,
      categories:   b.categories || [],
    }));

    // Cash flow: ALL 12 months of the selected year with income, expenses, payroll
    // Also include daily breakdown for months that have data
    const MONTH_NAMES_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    // Fetch all records for the full year (already have annualIncome/Expenses/Payroll)
    const cashFlow = MONTH_NAMES_SHORT.map((label, idx) => {
      const mNum   = idx + 1;
      const mStart = new Date(year, idx, 1);
      const mEnd   = new Date(year, idx + 1, 0, 23, 59, 59);

      const mIncome   = annualIncome.filter(r => {
        const d = new Date(r.incomeDate);
        return d >= mStart && d <= mEnd;
      }).reduce((s, r) => s + (r.amount || 0), 0);

      const mExpenses = annualExpenses.filter(r => {
        const d = new Date(r.expenseDate);
        return d >= mStart && d <= mEnd;
      }).reduce((s, r) => s + (r.amount || 0), 0);

      const mPayroll  = annualPayroll.filter(r => {
        const d = new Date(r.paidAt || r.updatedAt);
        return d >= mStart && d <= mEnd;
      }).reduce((s, r) => s + (r.netSalary || 0), 0);

      const mCosts  = mExpenses + mPayroll;
      const mNet    = mIncome - mCosts;

      return {
        month:    label,
        monthNum: mNum,
        income:   mIncome,
        expenses: mExpenses,
        payroll:  mPayroll,
        costs:    mCosts,
        net:      mNet,
        isProfit: mNet >= 0,
      };
    });

    // Daily breakdown for the selected month
    const daysInMonth = new Date(year, month, 0).getDate();
    const dailyCashFlow = Array.from({ length: daysInMonth }, (_, idx) => {
      const day    = idx + 1;
      const dStart = new Date(year, month - 1, day, 0, 0, 0);
      const dEnd   = new Date(year, month - 1, day, 23, 59, 59);

      const dIncome   = annualIncome.filter(r => {
        const d = new Date(r.incomeDate);
        return d >= dStart && d <= dEnd;
      }).reduce((s, r) => s + (r.amount || 0), 0);

      const dExpenses = annualExpenses.filter(r => {
        const d = new Date(r.expenseDate);
        return d >= dStart && d <= dEnd;
      }).reduce((s, r) => s + (r.amount || 0), 0);

      return {
        day:      day,
        label:    `${MONTH_NAMES_SHORT[month - 1]} ${day}`,
        income:   dIncome,
        expenses: dExpenses,
        net:      dIncome - dExpenses,
      };
    }).filter(d => d.income > 0 || d.expenses > 0); // only days with activity

    return res.json({
      year, month,
      annual: {
        income: annualTotalIncome, expenses: annualTotalExpenses,
        payroll: annualTotalPayroll, costs: annualTotalCosts,
        profitLoss: annualPL, isProfit: annualPL >= 0,
        margin: annualTotalIncome > 0 ? +((annualPL / annualTotalIncome) * 100).toFixed(1) : 0,
      },
      monthly: {
        income: monthlyTotalIncome, expenses: monthlyTotalExpenses,
        payroll: monthlyTotalPayroll, costs: monthlyTotalCosts,
        profitLoss: monthlyPL, isProfit: monthlyPL >= 0,
      },
      incomeBySource, expenseByCategory, payrollBreakdown,
      budgetVsActual, cashFlow, dailyCashFlow,
      pendingExpenses, pendingPayrolls,
      currency: 'ETB',
    });
  } catch (err) { return res.status(500).json({ message: err.message }); }
});

module.exports = router;
