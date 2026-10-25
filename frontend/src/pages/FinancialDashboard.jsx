import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { financialAuditApi, budgetApi, formatETB } from '../services/api';

const SOURCE_LABEL = {
  crop_sales:'Crop Sales', livestock:'Livestock',
  government_grant:'Gov. Grant', consulting:'Consulting',
  donation:'Donation', rent:'Rent', other:'Other',
};
const SOURCE_COLOR = {
  crop_sales:'#22c55e', livestock:'#84cc16', government_grant:'#3b82f6',
  consulting:'#8b5cf6', donation:'#f59e0b', rent:'#f97316', other:'#6b7280',
};
const CAT_LABEL = {
  salaries:'Salaries', seeds:'Seeds', fertilizer:'Fertilizer',
  irrigation:'Irrigation', fuel:'Fuel', equipment:'Equipment',
  maintenance:'Maintenance', transport:'Transport',
  farm_operations:'Farm Ops', office:'Office', other:'Other',
};
const CAT_COLOR = {
  salaries:'#ef4444', seeds:'#22c55e', fertilizer:'#84cc16',
  irrigation:'#3b82f6', fuel:'#f97316', equipment:'#8b5cf6',
  maintenance:'#f59e0b', transport:'#14b8a6', farm_operations:'#06b6d4',
  office:'#6b7280', other:'#9ca3af',
};
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function MetricCard({ label, value, sub, color, icon, onClick }) {
  return (
    <div onClick={onClick}
      style={{ background:'#fff', border:`1.5px solid ${color}33`, borderRadius:12,
        padding:'1rem 1.2rem', cursor: onClick ? 'pointer' : 'default',
        borderLeft:`4px solid ${color}`, boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
        <span style={{ fontSize:'0.73rem', fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</span>
        {icon && <i className={`fi ${icon}`} style={{ color, fontSize:'1.1rem' }} />}
      </div>
      <div style={{ fontSize:'1.4rem', fontWeight:800, color }}>{value}</div>
      {sub && <div style={{ fontSize:'0.72rem', color:'#9ca3af', marginTop:3 }}>{sub}</div>}
    </div>
  );
}

function BarChart({ data, valueKey, labelKey, color, height = 90 }) {
  if (!data?.length) return <div style={{ color:'#9ca3af', fontSize:'0.83rem', textAlign:'center', padding:'1rem' }}>No data</div>;
  const max = Math.max(...data.map(d => d[valueKey] || 0), 1);
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:6, height }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
          <span style={{ fontSize:'0.63rem', color:'#6b7280', fontWeight:600 }}>
            {formatETB(d[valueKey]).replace('ETB','').trim()}
          </span>
          <div style={{ width:'100%', background:`${color}cc`, borderRadius:'4px 4px 0 0',
            height:`${((d[valueKey] || 0) / max) * (height - 24)}px`, minHeight:3 }} />
          <span style={{ fontSize:'0.62rem', color:'#9ca3af' }}>{d[labelKey]}</span>
        </div>
      ))}
    </div>
  );
}

// ── Multi-series cash flow chart: income + expenses + payroll per month ────────
function CashFlowChart({ data, height = 160 }) {
  if (!data?.length) return (
    <div style={{ color:'#9ca3af', textAlign:'center', padding:'2rem', fontSize:'0.85rem' }}>
      No cash flow data for this year.
    </div>
  );
  const maxVal = Math.max(...data.flatMap(d => [d.income||0, d.expenses||0, d.payroll||0]), 1);
  const barH   = height - 40;
  const px = v => Math.max(2, Math.round((v / maxVal) * barH));
  const series = [
    { key:'income',   color:'#16a34a', label:'Income'   },
    { key:'expenses', color:'#dc2626', label:'Expenses' },
    { key:'payroll',  color:'#7c3aed', label:'Payroll'  },
  ];
  const hasAny = data.some(d => d.income > 0 || d.expenses > 0 || d.payroll > 0);
  return (
    <div>
      {/* Legend */}
      <div style={{ display:'flex', gap:'1.2rem', marginBottom:'0.7rem', flexWrap:'wrap', alignItems:'center' }}>
        {series.map(s => (
          <span key={s.key} style={{ display:'flex', alignItems:'center', gap:5, fontSize:'0.75rem', fontWeight:600, color:'#374151' }}>
            <span style={{ width:12, height:12, borderRadius:3, background:s.color }} />{s.label}
          </span>
        ))}
        <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:'0.75rem', fontWeight:600, color:'#374151', marginLeft:'auto' }}>
          <span style={{ width:18, height:3, background:'#166534', borderRadius:2 }} />Net P&amp;L
        </span>
      </div>
      {!hasAny ? (
        <div style={{ color:'#9ca3af', textAlign:'center', padding:'1.5rem 0', fontSize:'0.83rem' }}>
          No financial records found for this year.
        </div>
      ) : (
        <div style={{ display:'flex', alignItems:'flex-end', gap:4, height, borderBottom:'2px solid #e5e7eb', overflowX:'auto' }}>
          {data.map((d, i) => (
            <div key={i} style={{ flex:1, minWidth:26, display:'flex', flexDirection:'column', alignItems:'center', position:'relative' }}>
              {/* Net dot */}
              {(d.income > 0 || d.expenses > 0) && (
                <div style={{
                  position:'absolute',
                  bottom: Math.max(px(d.income), px(d.expenses), px(d.payroll)) + 14,
                  left:'50%', transform:'translateX(-50%)',
                  width:6, height:6, borderRadius:'50%',
                  background: d.isProfit ? '#16a34a' : '#ef4444',
                  border:'1.5px solid #fff', zIndex:2,
                }} title={`Net: ${formatETB(d.net)}`} />
              )}
              {/* Grouped bars */}
              <div style={{ display:'flex', gap:2, alignItems:'flex-end', height: barH, paddingTop:14 }}>
                {series.map(s => {
                  const v = d[s.key] || 0;
                  return (
                    <div key={s.key} title={`${s.label}: ${formatETB(v)}`}
                      style={{ width:7, borderRadius:'3px 3px 0 0',
                        background: v > 0 ? s.color : '#f3f4f6',
                        height:`${px(v)}px`, transition:'height 0.4s ease', opacity:0.9 }} />
                  );
                })}
              </div>
              <span style={{ fontSize:'0.62rem', color:'#9ca3af', marginTop:3, whiteSpace:'nowrap' }}>{d.month}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Daily cash flow for the selected month ────────────────────────────────────
function DailyCashFlow({ data, month, year, height = 90 }) {
  if (!data?.length) return (
    <div style={{ color:'#9ca3af', textAlign:'center', padding:'1rem', fontSize:'0.82rem' }}>
      No transactions on record for {MONTHS[month-1]} {year}.
    </div>
  );
  const maxVal = Math.max(...data.flatMap(d => [d.income||0, d.expenses||0]), 1);
  const barH   = height - 22;
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:3, height, borderBottom:'1px solid #e5e7eb', overflowX:'auto' }}>
      {data.map((d, i) => (
        <div key={i} style={{ minWidth:20, flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:1 }}>
          <div style={{ display:'flex', gap:2, alignItems:'flex-end', height: barH }}>
            {d.income > 0 && (
              <div title={`Income: ${formatETB(d.income)}`}
                style={{ width:7, background:'#16a34a', borderRadius:'3px 3px 0 0', opacity:0.85,
                  height:`${Math.max(2, Math.round((d.income/maxVal)*barH))}px` }} />
            )}
            {d.expenses > 0 && (
              <div title={`Expenses: ${formatETB(d.expenses)}`}
                style={{ width:7, background:'#dc2626', borderRadius:'3px 3px 0 0', opacity:0.85,
                  height:`${Math.max(2, Math.round((d.expenses/maxVal)*barH))}px` }} />
            )}
          </div>
          <span style={{ fontSize:'0.6rem', color:'#9ca3af' }}>{d.day}</span>
        </div>
      ))}
    </div>
  );
}
function PieRow({ label, value, total, color }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ marginBottom:'0.5rem' }}>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.8rem', marginBottom:3 }}>
        <span style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ width:10, height:10, borderRadius:'50%', background:color, display:'inline-block', flexShrink:0 }} />
          {label}
        </span>
        <span style={{ fontWeight:700, color }}>{formatETB(value)} <span style={{ color:'#9ca3af', fontWeight:400 }}>({pct}%)</span></span>
      </div>
      <div style={{ height:6, background:'#f3f4f6', borderRadius:3, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:3, transition:'width 0.5s' }} />
      </div>
    </div>
  );
}

export default function FinancialDashboard() {
  const { user }   = useAuth();
  const { t }      = useLang();
  const navigate   = useNavigate();
  const now        = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data,  setData]  = useState(null);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [summary, bRes] = await Promise.all([
        financialAuditApi.getSummary(year, month),
        budgetApi.getAll({ year, status: 'active' }).catch(() => ({ budgets: [] })),
      ]);
      setData(summary);
      setBudgets(bRes?.budgets || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  if (loading) return (
    <div style={{ textAlign:'center', padding:'3rem', color:'var(--text-muted)' }}>
      <i className="fi fi-rr-spinner" style={{ fontSize:'2rem', display:'block', marginBottom:10 }} />
      Loading financial data…
    </div>
  );

  if (error) return (
    <div className="alert alert-error"><i className="fi fi-rr-triangle-warning" style={{ marginRight:6 }} />{error}</div>
  );

  const a = data?.annual   || {};
  const m = data?.monthly  || {};
  const pb = data?.payrollBreakdown || {};

  const plColor    = a.isProfit ? '#16a34a' : '#dc2626';
  const plIcon     = a.isProfit ? 'fi-rr-arrow-trend-up' : 'fi-rr-arrow-trend-down';

  const incomeSources = Object.entries(data?.incomeBySource   || {}).sort((a,b) => b[1]-a[1]);
  const expenseCats   = Object.entries(data?.expenseByCategory || {}).sort((a,b) => b[1]-a[1]);

  return (
    <div style={{ maxWidth:1300, margin:'0 auto', paddingBottom:'2rem' }}>

      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1><i className="fi fi-rr-chart-histogram" style={{ marginRight:8, color:'#166534' }} />
            Financial Dashboard
          </h1>
          <p style={{ color:'var(--text-muted)', fontSize:'0.83rem', margin:'4px 0 0' }}>
            Income · Expenses · Payroll · Budget · Profit & Loss
          </p>
        </div>
        <div className="header-actions">
          <select value={month} onChange={e => setMonth(Number(e.target.value))}
            style={{ padding:'0.4rem 0.7rem', borderRadius:7, border:'1px solid var(--border)', fontSize:'0.85rem' }}>
            {MONTHS.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            style={{ padding:'0.4rem 0.7rem', borderRadius:7, border:'1px solid var(--border)', fontSize:'0.85rem' }}>
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="btn btn-outline btn-sm" onClick={load}><i className="fi fi-rr-refresh" /></button>
        </div>
      </div>

      {/* ── Pending approvals banner ── */}
      {(data?.pendingExpenses > 0 || data?.pendingPayrolls > 0) && (
        <div style={{ background:'#fffbeb', border:'1px solid #fcd34d', borderRadius:10,
          padding:'0.65rem 1rem', marginBottom:'1rem', display:'flex', flexWrap:'wrap', gap:12,
          alignItems:'center', fontSize:'0.85rem', color:'#92400e' }}>
          <i className="fi fi-rr-alarm-clock" />
          {data.pendingExpenses > 0 && (
            <span><strong>{data.pendingExpenses}</strong> expense{data.pendingExpenses>1?'s':''} awaiting approval</span>
          )}
          {data.pendingPayrolls > 0 && (
            <span><strong>{data.pendingPayrolls}</strong> payroll record{data.pendingPayrolls>1?'s':''} awaiting approval</span>
          )}
          <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
            {data.pendingExpenses > 0 && (
              <button onClick={() => navigate('/expenses')}
                style={{ background:'#166534', color:'#fff', border:'none', borderRadius:6,
                  padding:'3px 12px', cursor:'pointer', fontSize:'0.8rem', fontWeight:700 }}>
                Expenses
              </button>
            )}
            {data.pendingPayrolls > 0 && (
              <button onClick={() => navigate('/payroll')}
                style={{ background:'#1e40af', color:'#fff', border:'none', borderRadius:6,
                  padding:'3px 12px', cursor:'pointer', fontSize:'0.8rem', fontWeight:700 }}>
                Payroll
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Annual KPI cards ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'0.85rem', marginBottom:'1.5rem' }}>
        <MetricCard label="Annual Income"    value={formatETB(a.income)}   color="#16a34a" icon="fi-rr-arrow-trend-up"   onClick={() => navigate('/income')} />
        <MetricCard label="Annual Expenses"  value={formatETB(a.expenses)} color="#dc2626" icon="fi-rr-receipt"          onClick={() => navigate('/expenses')} />
        <MetricCard label="Annual Payroll"   value={formatETB(a.payroll)}  color="#7c3aed" icon="fi-rr-money-check-edit" onClick={() => navigate('/payroll')} />
        <MetricCard label="Total Costs"      value={formatETB(a.costs)}    color="#b45309" icon="fi-rr-piggy-bank" />
        <MetricCard label="Profit / Loss"    value={formatETB(a.profitLoss)}
          sub={`${a.margin}% margin`} color={plColor} icon={plIcon} />
      </div>

      {/* ── Monthly snapshot row ── */}
      <div style={{ background: m.isProfit ? '#f0fdf4' : '#fef2f2',
        border:`1.5px solid ${m.isProfit ? '#86efac' : '#fca5a5'}`,
        borderRadius:12, padding:'0.9rem 1.2rem', marginBottom:'1.5rem',
        display:'flex', flexWrap:'wrap', gap:'1.5rem', alignItems:'center' }}>
        <div>
          <div style={{ fontSize:'0.7rem', color:'#6b7280', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>
            {MONTHS[month-1]} {year} — This Month
          </div>
          <div style={{ fontSize:'1.6rem', fontWeight:800, color: m.isProfit ? '#16a34a' : '#dc2626' }}>
            {formatETB(m.profitLoss)}
          </div>
          <div style={{ fontSize:'0.75rem', color:'#6b7280' }}>
            {m.isProfit ? 'Net Profit' : 'Net Loss'}
          </div>
        </div>
        {[
          { label:'Income',   value:m.income,   color:'#16a34a' },
          { label:'Expenses', value:m.expenses, color:'#dc2626' },
          { label:'Payroll',  value:m.payroll,  color:'#7c3aed' },
        ].map(s => (
          <div key={s.label} style={{ textAlign:'center' }}>
            <div style={{ fontSize:'0.68rem', color:'#9ca3af', fontWeight:600 }}>{s.label}</div>
            <div style={{ fontWeight:700, color:s.color, fontSize:'1rem' }}>{formatETB(s.value)}</div>
          </div>
        ))}
      </div>

      {/* ── Main 3-column grid ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'1rem', marginBottom:'1rem' }}>

        {/* Income by source */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><i className="fi fi-rr-arrow-trend-up" style={{ marginRight:6, color:'#16a34a' }} />Income by Source</span>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/income')}>View</button>
          </div>
          {incomeSources.length === 0 ? (
            <p style={{ color:'var(--text-muted)', fontSize:'0.83rem', textAlign:'center', padding:'1rem 0' }}>No income recorded for {year}</p>
          ) : (
            <div>
              {incomeSources.map(([k,v]) => (
                <PieRow key={k} label={SOURCE_LABEL[k]||k} value={v} total={a.income} color={SOURCE_COLOR[k]||'#6b7280'} />
              ))}
              <div style={{ borderTop:'1px solid var(--border)', marginTop:8, paddingTop:8, display:'flex', justifyContent:'space-between', fontWeight:700, fontSize:'0.88rem' }}>
                <span>Total</span><span style={{ color:'#16a34a' }}>{formatETB(a.income)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Expenses by category */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><i className="fi fi-rr-receipt" style={{ marginRight:6, color:'#dc2626' }} />Expenses by Category</span>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/expenses')}>View</button>
          </div>
          {expenseCats.length === 0 ? (
            <p style={{ color:'var(--text-muted)', fontSize:'0.83rem', textAlign:'center', padding:'1rem 0' }}>No expenses for {year}</p>
          ) : (
            <div>
              {expenseCats.slice(0, 7).map(([k,v]) => (
                <PieRow key={k} label={CAT_LABEL[k]||k} value={v} total={a.expenses} color={CAT_COLOR[k]||'#6b7280'} />
              ))}
              <div style={{ borderTop:'1px solid var(--border)', marginTop:8, paddingTop:8, display:'flex', justifyContent:'space-between', fontWeight:700, fontSize:'0.88rem' }}>
                <span>Total</span><span style={{ color:'#dc2626' }}>{formatETB(a.expenses)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Payroll breakdown */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><i className="fi fi-rr-money-check-edit" style={{ marginRight:6, color:'#7c3aed' }} />Payroll Breakdown</span>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/payroll')}>View</button>
          </div>
          {!pb.netTotal ? (
            <p style={{ color:'var(--text-muted)', fontSize:'0.83rem', textAlign:'center', padding:'1rem 0' }}>No paid payroll for {year}</p>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'0.45rem' }}>
              {[
                { label:'Gross Salary',    value:pb.grossTotal,     color:'#7c3aed' },
                { label:'Net Pay (take-home)', value:pb.netTotal,   color:'#16a34a' },
                { label:'Income Tax',      value:pb.taxTotal,       color:'#ef4444' },
                { label:'Pension (Employee 7%)', value:pb.pensionEmpTotal,  color:'#f59e0b' },
                { label:'Pension (Employer 11%)',value:pb.pensionEmpRTotal, color:'#f97316' },
              ].map(row => (
                <div key={row.label} style={{ display:'flex', justifyContent:'space-between', fontSize:'0.82rem', padding:'0.3rem 0', borderBottom:'1px solid #f3f4f6' }}>
                  <span style={{ color:'#374151' }}>{row.label}</span>
                  <span style={{ fontWeight:700, color:row.color }}>{formatETB(row.value)}</span>
                </div>
              ))}
              <div style={{ borderTop:'2px solid var(--border)', marginTop:4, paddingTop:6, display:'flex', justifyContent:'space-between', fontSize:'0.85rem', fontWeight:700 }}>
                <span style={{ color:'#6b7280' }}>{pb.headcount} employees paid</span>
                <span style={{ color:'#7c3aed' }}>{formatETB(pb.netTotal)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Budget vs Actual ── */}
      {data?.budgetVsActual?.length > 0 && (
        <div className="card" style={{ marginBottom:'1rem' }}>
          <div className="card-header">
            <span className="card-title"><i className="fi fi-rr-coin" style={{ marginRight:6, color:'#166534' }} />Budget vs Actual — {year}</span>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/budget')}>Manage</button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:'0.8rem' }}>
            {data.budgetVsActual.map(b => {
              const usedPct = b.totalBudget > 0 ? Math.min(100, Math.round((b.totalUsed / b.totalBudget) * 100)) : 0;
              const revPct  = b.revenueTarget > 0 ? Math.min(100, Math.round((a.income / b.revenueTarget) * 100)) : null;
              const overBudget = usedPct > 90;
              return (
                <div key={String(b.id)} style={{ background:'#f9fafb', borderRadius:10, padding:'0.9rem 1rem', border:'1px solid #e5e7eb' }}>
                  <div style={{ fontWeight:700, fontSize:'0.88rem', marginBottom:6 }}>{b.title}</div>
                  {/* Budget utilization */}
                  <div style={{ marginBottom:4 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.73rem', color:'#6b7280', marginBottom:3 }}>
                      <span>Budget Used</span>
                      <span style={{ fontWeight:700, color: overBudget ? '#ef4444' : '#374151' }}>
                        {formatETB(b.totalUsed)} / {formatETB(b.totalBudget)} ({usedPct}%)
                      </span>
                    </div>
                    <div style={{ height:8, background:'#e5e7eb', borderRadius:4, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${usedPct}%`, background: overBudget ? '#ef4444' : '#166534', borderRadius:4, transition:'width 0.5s' }} />
                    </div>
                  </div>
                  {/* Revenue target */}
                  {revPct !== null && (
                    <div>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.73rem', color:'#6b7280', marginBottom:3 }}>
                        <span>Revenue Target</span>
                        <span style={{ fontWeight:700, color: revPct >= 100 ? '#16a34a' : '#f59e0b' }}>
                          {formatETB(a.income)} / {formatETB(b.revenueTarget)} ({revPct}%)
                        </span>
                      </div>
                      <div style={{ height:8, background:'#e5e7eb', borderRadius:4, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${revPct}%`, background: revPct >= 100 ? '#16a34a' : '#f59e0b', borderRadius:4, transition:'width 0.5s' }} />
                      </div>
                    </div>
                  )}
                  <div style={{ marginTop:8, display:'flex', justifyContent:'space-between', fontSize:'0.72rem' }}>
                    <span style={{ color: b.remaining >= 0 ? '#166534' : '#dc2626' }}>
                      {b.remaining >= 0 ? `${formatETB(b.remaining)} remaining` : `${formatETB(Math.abs(b.remaining))} over budget`}
                    </span>
                    <span style={{ color:'#9ca3af', textTransform:'capitalize' }}>{b.type}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Cash Flow Chart: 12 months income + expenses + payroll ── */}
      <div className="card" style={{ marginBottom:'1rem' }}>
        <div className="card-header">
          <span className="card-title">
            <i className="fi fi-rr-chart-histogram" style={{ marginRight:6, color:'#166534' }} />
            Cash Flow — {year} (All 12 Months)
          </span>
        </div>
        <CashFlowChart data={data?.cashFlow} height={180} />

        {/* Monthly totals summary row */}
        {data?.cashFlow?.some(d => d.income > 0 || d.expenses > 0 || d.payroll > 0) && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(100px,1fr))', gap:'0.35rem', marginTop:'0.9rem', borderTop:'1px solid #f3f4f6', paddingTop:'0.8rem' }}>
            {data.cashFlow.map(d => (
              (d.income > 0 || d.expenses > 0 || d.payroll > 0) && (
                <div key={d.monthNum} style={{ background: d.isProfit ? '#f0fdf4' : '#fef2f2',
                  border:`1px solid ${d.isProfit ? '#bbf7d0' : '#fecaca'}`,
                  borderRadius:8, padding:'0.35rem 0.5rem', textAlign:'center' }}>
                  <div style={{ fontSize:'0.68rem', color:'#6b7280', fontWeight:700 }}>{d.month}</div>
                  <div style={{ fontSize:'0.78rem', fontWeight:800, color: d.isProfit ? '#16a34a' : '#dc2626' }}>
                    {formatETB(d.net).replace('ETB ','').replace('ETB','').trim()}
                  </div>
                  <div style={{ fontSize:'0.6rem', color: d.isProfit ? '#16a34a' : '#dc2626' }}>
                    {d.isProfit ? '▲ profit' : '▼ loss'}
                  </div>
                </div>
              )
            ))}
          </div>
        )}
      </div>

      {/* ── Daily Cash Flow: selected month ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <i className="fi fi-rr-calendar" style={{ marginRight:6, color:'#0891b2' }} />
            Daily Activity — {MONTHS[month-1]} {year}
          </span>
          <div style={{ display:'flex', gap:8, alignItems:'center', fontSize:'0.75rem' }}>
            <span style={{ display:'flex', alignItems:'center', gap:4 }}>
              <span style={{ width:10, height:10, borderRadius:2, background:'#16a34a', display:'inline-block' }} />Income
            </span>
            <span style={{ display:'flex', alignItems:'center', gap:4 }}>
              <span style={{ width:10, height:10, borderRadius:2, background:'#dc2626', display:'inline-block' }} />Expenses
            </span>
          </div>
        </div>
        <DailyCashFlow data={data?.dailyCashFlow} month={month} year={year} height={110} />
      </div>
    </div>
  );
}
