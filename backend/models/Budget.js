/**
 * Budget Model — annual / seasonal / monthly budget in ETB
 * Categories: salaries, seeds, fertilizer, irrigation, fuel, equipment,
 *             maintenance, transport, farm_operations, other
 */
const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name:      { type: String, required: true }, // e.g. "salaries"
  label:     { type: String, default: '' },    // display label
  allocated: { type: Number, default: 0, min: 0 },
  used:      { type: Number, default: 0, min: 0 },
},
 { _id: false });

const budgetSchema = new mongoose.Schema({
  title:     { type: String, required: true, trim: true },
  type:      { type: String, enum: ['annual','seasonal','monthly'], required: true },
  year:      { type: Number, required: true },
  month:     { type: Number, default: null },   // 1-12 for monthly budgets
  season:    { type: String, enum: ['kiremt','bega','belg','tsedey',''], default: '' }, // Ethiopian seasons

  totalBudget: { type: Number, default: 0, min: 0 },  // ETB
  currency:    { type: String, default: 'ETB' },

  categories: {
    type: [categorySchema],
    default: [
      { name: 'salaries',        label: 'Employee Salaries',   allocated: 0, used: 0 },
      { name: 'seeds',           label: 'Seeds',               allocated: 0, used: 0 },
      { name: 'fertilizer',      label: 'Fertilizer',          allocated: 0, used: 0 },
      { name: 'irrigation',      label: 'Irrigation',          allocated: 0, used: 0 },
      { name: 'fuel',            label: 'Fuel',                allocated: 0, used: 0 },
      { name: 'equipment',       label: 'Equipment',           allocated: 0, used: 0 },
      { name: 'maintenance',     label: 'Maintenance',         allocated: 0, used: 0 },
      { name: 'transport',       label: 'Transport',           allocated: 0, used: 0 },
      { name: 'farm_operations', label: 'Farm Operations',     allocated: 0, used: 0 },
      { name: 'other',           label: 'Other Expenses',      allocated: 0, used: 0 },
    ],
  },

  notes:     { type: String, default: '', maxlength: 500 },
  status:    { type: String, enum: ['draft','active','closed'], default: 'draft' },
  isActive:  { type: Boolean, default: true },
  revenueTarget: { type: Number, default: 0, min: 0 }, // projected/target income for this budget period

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedBy:{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt:{ type: Date, default: null },
}, { timestamps: true });

// Virtuals
budgetSchema.virtual('totalAllocated').get(function () {
  return this.categories.reduce((s, c) => s + (c.allocated || 0), 0);
});
budgetSchema.virtual('totalUsed').get(function () {
  return this.categories.reduce((s, c) => s + (c.used || 0), 0);
});
budgetSchema.virtual('remaining').get(function () {
  return this.totalBudget - this.categories.reduce((s, c) => s + (c.used || 0), 0);
});
budgetSchema.virtual('utilizationPct').get(function () {
  if (!this.totalBudget) return 0;
  return +((this.categories.reduce((s, c) => s + (c.used || 0), 0) / this.totalBudget) * 100).toFixed(1);
});

budgetSchema.virtual('id').get(function () { return this._id.toHexString(); });
budgetSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Budget', budgetSchema);
