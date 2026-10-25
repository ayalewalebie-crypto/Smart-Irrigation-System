/**
 * HomePage — role-based dashboard router
 *
 * Farm Owner    → OwnerDashboard    (full: sensors, irrigation, finance, tasks, employees)
 * Admin         → AdminDashboard    (system: users, devices, farms, tasks)
 * Office Manager→ OfficeManagerDashboard (HR: employees, attendance, payroll, tasks)
 * Laborer       → LaborDashboard    (personal: my tasks, attendance, assigned farm)
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import {
  dashboardApi, zoneApi, sensorApi, taskApi,
  budgetApi, expenseApi, incomeApi, payrollApi, financialAuditApi,
  attendanceApi, userApi, formatETB,
} from '../services/api';

export default function HomePage() {
  const { user } = useAuth();
  const { t }    = useLang();
  switch (user?.role) {
    case 'owner':          return <OwnerDashboard />;
    case 'admin':          return <AdminDashboard />;
    case 'office_manager': return <OfficeManagerDashboard />;
    default:               return <LaborDashboard />;
  }
}

// ── Shared helpers ─────────────────────────────────────────────────────────────
const PRIORITY_COLOR = { high: '#ef4444', urgent: '#b91c1c', medium: '#f59e0b', low: '#22c55e' };
const STATUS_COLOR   = { pending: '#6b7280', in_progress: '#3b82f6', completed: '#22c55e', overdue: '#ef4444' };
const STATUS_LABEL   = { pending: 'Pending', in_progress: 'In Progress', completed: 'Completed', overdue: 'Overdue' };
const PAYROLL_COLOR  = { draft: '#9ca3af', submitted: '#f59e0b', approved: '#3b82f6', paid: '#22c55e', rejected: '#ef4444' };
const ATT_COLOR      = { present: '#22c55e', absent: '#ef4444', late: '#f97316', half_day: '#f59e0b', leave: '#8b5cf6', holiday: '#6b7280', overtime: '#3b82f6' };

function StatCard({ icon, label, value, sub, color, onClick, badge }) {
  return (
    <div className={`stat-card${color ? ' ' + color : ''}${onClick ? ' clickable' : ''}`}
      onClick={onClick} style={onClick ? { cursor: 'pointer' } : {}}>
      <span className="stat-icon"><i className={`fi ${icon}`} /></span>
      <div className="stat-info">
        <label>{label}</label>
        <strong>{value ?? '—'}</strong>
        {sub && <span>{sub}</span>}
      </div>
      {badge !== undefined && badge > 0 && (
        <span style={{ marginLeft: 'auto', background: '#ef4444', color: '#fff', borderRadius: 20, padding: '1px 8px', fontSize: '0.68rem', fontWeight: 700, flexShrink: 0 }}>{badge}</span>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ height: 80, background: '#e5e7eb', borderRadius: 10, animation: 'pulse 1.5s infinite' }}>
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
        </div>
      ))}
    </div>
  );
}

function ActivityFeed({ items, onRefresh }) {
  const { t } = useLang();
  const TYPE_ICON = { info: '💬', success: '✅', warning: '⚠️', danger: '🔴' };
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title"><i className="fi fi-rr-time-past" style={{ marginRight: 6 }} />{t('recentActivity')}</span>
        <button className="btn btn-outline btn-sm" onClick={onRefresh}><i className="fi fi-rr-refresh" /></button>
      </div>
      {items.length === 0
        ? <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem 0', fontSize: '0.88rem' }}>{t('noRecords')}</p>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 260, overflowY: 'auto' }}>
            {items.slice(0, 10).map((item, i) => (
              <div key={item.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.45rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.83rem' }}>
                <span style={{ width: 22, flexShrink: 0 }}>{TYPE_ICON[item.type] ?? '•'}</span>
                <span style={{ flex: 1 }}>{item.text || item.event}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{item.time}</span>
                <span className={`badge badge-${item.type}`}>{item.type}</span>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

function WaterChart({ data }) {
  const { t } = useLang();
  if (!data?.length) return null;
  const max = Math.max(...data.map(r => r.value), 1);
  return (
    <div className="card">
      <div className="card-header"><span className="card-title"><i className="fi fi-rr-chart-histogram" style={{ marginRight: 6 }} />{t('waterUsage')} (L) — Last 7 Days</span></div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120, padding: '0 0.5rem' }}>
        {data.map((row, i) => (
          <div key={i} className="chart-bar-col">
            <div className="chart-bar" style={{ height: `${(row.value / max) * 100}%`, background: i === data.length - 1 ? 'var(--accent)' : 'var(--primary)', opacity: 0.85 }} />
            <span className="chart-bar-label">{row.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuickActions({ items }) {
  const { t } = useLang();
  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <div className="card-header"><span className="card-title"><i className="fi fi-rr-rocket" style={{ marginRight: 6 }} />{t('quickActions')}</span></div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {items.map(q => (
          <button key={q.label} className="btn btn-outline btn-sm" onClick={q.action}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.5rem 0.9rem' }}>
            <i className={`fi ${q.icon}`} />{q.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SensorCard({ s }) {
  const { t } = useLang();
  const r = s.reading || {};
  const alive = s.online;
  return (
    <div style={{ background: alive ? '#f0fdf4' : '#f9fafb', border: `1px solid ${alive ? '#86efac' : '#e5e7eb'}`, borderRadius: 10, padding: '0.75rem 1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{s.name || s.deviceId}</span>
        <span style={{ fontSize: '0.68rem', fontWeight: 700, background: alive ? '#dcfce7' : '#f3f4f6', color: alive ? '#166534' : '#9ca3af', borderRadius: 20, padding: '1px 8px' }}>
          {alive ? `● ${t('deviceOnline')}` : `○ ${t('deviceOffline')}`}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {r.moisture   !== undefined && <Chip icon="fi-rr-leaf"             label={t('moisture')}    value={`${r.moisture}%`}     warn={r.moisture < 30 || r.moisture > 80} />}
        {r.temp       !== undefined && <Chip icon="fi-rr-temperature-high" label={t('temperature')} value={`${r.temp}°C`}         warn={r.temp > 38} />}
        {r.humidity   !== undefined && <Chip icon="fi-rr-cloud"            label={t('humidity')}    value={`${r.humidity}%`} />}
        {r.waterLevel !== undefined && <Chip icon="fi-rr-tint"             label={t('waterLevel')}  value={`${r.waterLevel}%`}    warn={r.waterLevel < 20} />}
        {r.ph         !== undefined && <Chip icon="fi-rr-flask"            label={t('pH')}          value={r.ph}                  warn={r.ph < 5.5 || r.ph > 7.5} />}
        {s.pumpStatus !== undefined && <Chip icon="fi-rr-engine"           label={t('pumpStatus')}  value={s.pumpStatus ? t('online') : t('offline')} />}
        {s.relayState !== undefined && <Chip icon="fi-rr-bolt"             label={t('relayState')}  value={s.relayState ? 'ON' : 'OFF'} />}
      </div>
      {s.zone && <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: 6 }}><i className="fi fi-rr-map-marker" style={{ marginRight: 3 }} />{s.zone}</div>}
    </div>
  );
}

function Chip({ icon, label, value, warn }) {
  return (
    <span style={{ fontSize: '0.72rem', background: warn ? '#fef2f2' : '#f3f4f6', color: warn ? '#dc2626' : '#374151', border: warn ? '1px solid #fecaca' : '1px solid #e5e7eb', borderRadius: 20, padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <i className={`fi ${icon}`} />{label}: <strong>{value}</strong>
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. FARM OWNER DASHBOARD
//    Soil moisture · Humidity · Temp · Water level · Pump · Irrigation
//    Sensor/device status · Water usage · Employees · Tasks · Budget · Alerts
// ══════════════════════════════════════════════════════════════════════════════
function OwnerDashboard() {
  const { t }    = useLang();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary,    setSummary]    = useState(null);
  const [sensors,    setSensors]    = useState([]);
  const [zones,      setZones]      = useState([]);
  const [activity,   setActivity]   = useState([]);
  const [waterChart, setWaterChart] = useState([]);
  const [budgetSum,  setBudgetSum]  = useState(null);
  const [pl,         setPL]         = useState(null);
  const [incomeSum,  setIncomeSum]  = useState(null);
  const [expenseSum, setExpenseSum] = useState(null);
  const [payrollSum, setPayrollSum] = useState(null);
  const [payrolls,   setPayrolls]   = useState([]);
  const [expenses,   setExpenses]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [actionMsg,  setActionMsg]  = useState('');
  const [controlling,setControlling]= useState(false);
  const [rejectPayrollId, setRejectPayrollId]   = useState(null);
  const [rejectExpenseId, setRejectExpenseId]   = useState(null);
  const [rejectReason,    setRejectReason]      = useState('');

  const now    = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [sum, sens, zns, act, chart, bSum, plData, incData, expData, paySum, payData, expPending] = await Promise.all([
        dashboardApi.getSummary(),
        sensorApi.getAll().catch(() => []),
        zoneApi.getAll().catch(() => []),
        dashboardApi.getActivity(),
        dashboardApi.getWaterChart(),
        budgetApi.getSummary(now.getFullYear()).catch(() => null),
        financialAuditApi.getPL().catch(() => null),
        incomeApi.getSummary().catch(() => null),
        expenseApi.getSummary().catch(() => null),
        payrollApi.getSummary(period).catch(() => null),
        payrollApi.getAll({ status: 'submitted', limit: 10 }).catch(() => ({ records: [] })),
        expenseApi.getAll({ status: 'submitted', limit: 10 }).catch(() => ({ expenses: [] })),
      ]);
      setSummary(sum);
      setSensors(Array.isArray(sens) ? sens : []);
      setZones(Array.isArray(zns) ? zns : []);
      setActivity(act);
      setWaterChart(chart);
      setBudgetSum(bSum);
      setPL(plData);
      setIncomeSum(incData);
      setExpenseSum(expData);
      setPayrollSum(paySum);
      setPayrolls(payData?.records || []);
      setExpenses(expPending?.expenses || []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleIrrigateAll = async () => {
    setControlling(true);
    try {
      const allActive = summary?.activeZones === summary?.totalZones;
      await zoneApi.controlAll(allActive ? 'stop' : 'start');
      setActionMsg(allActive ? 'All irrigation stopped.' : 'All zones irrigating.');
      await load();
    } catch (err) { setError(err.message); }
    finally { setControlling(false); }
  };

  const handlePayrollApprove = async (id) => {
    try { await payrollApi.approve(id); setActionMsg('Payroll approved!'); load(); }
    catch (e) { setError(e.message); }
  };
  const handlePayrollReject = async () => {
    if (!rejectReason.trim()) return;
    try { await payrollApi.reject(rejectPayrollId, rejectReason); setActionMsg('Payroll rejected.'); setRejectPayrollId(null); setRejectReason(''); load(); }
    catch (e) { setError(e.message); }
  };
  const handleExpenseApprove = async (id) => {
    try { await expenseApi.approve(id); setActionMsg('Expense approved!'); load(); }
    catch (e) { setError(e.message); }
  };
  const handleExpenseReject = async () => {
    if (!rejectReason.trim()) return;
    try { await expenseApi.reject(rejectExpenseId, rejectReason); setActionMsg('Expense rejected.'); setRejectExpenseId(null); setRejectReason(''); load(); }
    catch (e) { setError(e.message); }
  };

  if (loading) return <LoadingState />;
  const allActive = summary?.activeZones > 0 && summary?.activeZones === summary?.totalZones;

  const sensorAlerts = sensors.filter(s =>
    !s.online ||
    (s.reading?.moisture   !== undefined && (s.reading.moisture < 30 || s.reading.moisture > 80)) ||
    (s.reading?.temp       !== undefined && s.reading.temp > 38) ||
    (s.reading?.waterLevel !== undefined && s.reading.waterLevel < 20)
  );

  const submittedPayrolls = payrolls.filter(r => r.status === 'submitted');
  const submittedExpenses = expenses.filter(e => e.status === 'submitted');

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <h1>{t('welcomeBack')}, {user?.name?.split(' ')[0]}</h1>
        <div className="header-actions">
          <button className={`btn ${allActive ? 'btn-danger' : 'btn-primary'}`} onClick={handleIrrigateAll} disabled={controlling}>
            <i className={`fi ${allActive ? 'fi-rr-stop' : 'fi-rr-tint'}`} style={{ marginRight: 4 }} />
            {controlling ? t('loading') : allActive ? t('stopAll') : t('irrigateAll')}
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/sensors')}><i className="fi fi-rr-signal-alt" style={{ marginRight: 4 }} />{t('sensors')}</button>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/users')}><i className="fi fi-rr-users-alt" style={{ marginRight: 4 }} />{t('users')}</button>
          <button className="btn btn-outline btn-sm" onClick={load}><i className="fi fi-rr-refresh" /></button>
        </div>
      </div>

      {error     && <div className="alert alert-error"><i className="fi fi-rr-triangle-warning" style={{ marginRight: 6 }} />{error}</div>}
      {actionMsg && <div className="alert alert-success" style={{ marginBottom: '0.5rem' }}><i className="fi fi-rr-check" style={{ marginRight: 6 }} />{actionMsg}</div>}

      {/* Approval action banners */}
      {submittedPayrolls.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '0.65rem 1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.85rem', color: '#92400e' }}>
          <i className="fi fi-rr-money-check-edit" style={{ flexShrink: 0 }} />
          <strong>{submittedPayrolls.length} {t('payroll')} {t('pending')}</strong>
          <button onClick={() => navigate('/payroll')} style={{ marginLeft: 'auto', background: '#166534', color: '#fff', border: 'none', borderRadius: 6, padding: '3px 12px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>{t('view')}</button>
        </div>
      )}
      {submittedExpenses.length > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '0.65rem 1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.85rem', color: '#991b1b' }}>
          <i className="fi fi-rr-receipt" style={{ flexShrink: 0 }} />
          <strong>{submittedExpenses.length} {t('expenses')} {t('pending')}</strong>
          <button onClick={() => navigate('/expenses')} style={{ marginLeft: 'auto', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, padding: '3px 12px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>{t('view')}</button>
        </div>
      )}

      {sensorAlerts.length > 0 && (
        <div className="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="fi fi-rr-hexagon-exclamation" style={{ fontSize: '1.1rem', flexShrink: 0 }} />
          <span><strong>{sensorAlerts.length} {t('alerts')}</strong> — {sensorAlerts.slice(0, 2).map(s => s.name || s.deviceId).join(', ')}{sensorAlerts.length > 2 ? ` +${sensorAlerts.length - 2} more` : ''}</span>
          <button className="btn btn-sm" style={{ marginLeft: 'auto', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, padding: '3px 12px', flexShrink: 0 }} onClick={() => navigate('/sensors')}>{t('view')}</button>
        </div>
      )}

      {/* ── SECTION 1: Farm & Sensor Stats ── */}
      <div className="stats-grid">
        <StatCard icon="fi-rr-map-marker"       label={t('totalFarms')}     value={summary?.totalZones}    sub={t('farmControl')} onClick={() => navigate('/farm-control')} />
        <StatCard icon="fi-rr-tint"             label={t('irrigating')}     value={summary?.activeZones}   sub={t('active')}  color={summary?.activeZones > 0 ? 'success' : ''} />
        <StatCard icon="fi-rr-signal-alt"       label={t('activeSensors')}  value={`${summary?.onlineNodes ?? 0} / ${summary?.totalNodes ?? 0}`} sub={t('sensors')} color={summary?.systemStatus === 'online' ? 'success' : 'danger'} onClick={() => navigate('/sensors')} />
        <StatCard icon="fi-rr-leaf"             label={t('soilMoisture')}   value={`${summary?.avgMoisture ?? 0}%`}  sub="soil"     color={summary?.avgMoisture < 30 ? 'danger' : ''} />
        <StatCard icon="fi-rr-temperature-high" label={t('temperature')}    value={`${summary?.avgTemp ?? 0}°C`}     sub="ambient"  color={summary?.avgTemp > 38 ? 'danger' : ''} />
        <StatCard icon="fi-rr-cloud"            label={t('humidity')}       value={`${summary?.avgHumidity ?? 0}%`}  sub="air" />
        <StatCard icon="fi-rr-shower"           label={t('waterUsed')}      value={`${summary?.waterUsedToday ?? 0} L`} sub={t('date')} color="accent" />
        <StatCard icon="fi-rr-users-alt"        label={t('totalEmployees')} value={summary?.totalUsers}    sub={t('employees')} onClick={() => navigate('/users')} />
        <StatCard icon="fi-rr-clipboard-list"   label={t('pending')}        value={summary?.pendingTasks ?? 0}  sub={t('tasks')} color={summary?.pendingTasks > 0 ? 'danger' : ''} onClick={() => navigate('/tasks')} badge={summary?.pendingTasks} />
        <StatCard icon="fi-rr-check-circle"     label={t('completed')}      value={summary?.completedTasks ?? 0} sub={t('tasks')} color="success" onClick={() => navigate('/tasks')} />
      </div>

      {/* ── SECTION 2: Live Sensors ── */}
      {sensors.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-header">
            <span className="card-title"><i className="fi fi-rr-signal-alt" style={{ marginRight: 6 }} />Live Sensor Readings</span>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/sensors')}><i className="fi fi-rr-arrow-right" style={{ marginRight: 4 }} />All Sensors</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.6rem' }}>
            {sensors.slice(0, 4).map(s => <SensorCard key={s._id || s.id} s={s} />)}
          </div>
        </div>
      )}

      {/* ── SECTION 3: Zones ── */}
      {zones.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-header">
            <span className="card-title"><i className="fi fi-rr-seedling" style={{ marginRight: 6 }} />Farm Zones</span>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/farm-control')}><i className="fi fi-rr-arrow-right" style={{ marginRight: 4 }} />Manage Farms</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
            {zones.slice(0, 6).map(z => (
              <div key={z._id || z.id} style={{ padding: '0.6rem 0.8rem', borderRadius: 8, background: z.active ? '#f0fdf4' : '#f9fafb', border: `1px solid ${z.active ? '#86efac' : '#e5e7eb'}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fi fi-rr-map-marker" style={{ color: z.active ? '#16a34a' : '#9ca3af' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.83rem' }}>{z.name}</div>
                  <div style={{ fontSize: '0.7rem', color: z.active ? '#16a34a' : '#9ca3af' }}>{z.active ? 'Irrigating' : 'Idle'}</div>
                </div>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, background: z.active ? '#dcfce7' : '#f3f4f6', color: z.active ? '#166534' : '#6b7280', borderRadius: 20, padding: '1px 7px' }}>{z.active ? 'ON' : 'OFF'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SECTION 4: Financial Review ── */}
      <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="fi fi-rr-coins" style={{ color: '#166534' }} /> Financial Review — {now.getFullYear()}
        </h3>
        <button className="btn btn-outline btn-sm" onClick={() => navigate('/income')} style={{ fontSize: '0.78rem' }}>
          <i className="fi fi-rr-chart-histogram" style={{ marginRight: 4 }} />Full Report
        </button>
      </div>

      {/* Financial stat cards row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
        {[
          { icon: 'fi-rr-arrow-trend-up',   label: 'Total Income',    value: formatETB(incomeSum?.total  ?? 0),             color: '#166534', bg: '#f0fdf4', border: '#86efac',  onClick: () => navigate('/income') },
          { icon: 'fi-rr-receipt',           label: 'Total Expenses',  value: formatETB(expenseSum?.totalAmount ?? 0),       color: '#991b1b', bg: '#fef2f2', border: '#fca5a5',  onClick: () => navigate('/expenses') },
          { icon: 'fi-rr-money-check-edit',  label: `Payroll ${period}`, value: formatETB(payrollSum?.totalNet ?? 0),        color: '#0891b2', bg: '#eff6ff', border: '#bfdbfe',  onClick: () => navigate('/payroll') },
          { icon: 'fi-rr-coin',              label: 'Annual Budget',   value: formatETB(budgetSum?.totalBudget ?? 0),        color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe',  onClick: () => navigate('/budget') },
          {
            icon: pl?.isProfit ? 'fi-rr-arrow-trend-up' : 'fi-rr-arrow-trend-down',
            label: pl?.isProfit ? 'Net Profit' : 'Net Loss',
            value: formatETB(Math.abs(pl?.profitLoss ?? 0)),
            color: pl?.isProfit ? '#166534' : '#991b1b',
            bg: pl?.isProfit ? '#f0fdf4' : '#fef2f2',
            border: pl?.isProfit ? '#86efac' : '#fca5a5',
            onClick: () => navigate('/income'),
          },
        ].map(s => (
          <div key={s.label}
            onClick={s.onClick}
            style={{ background: s.bg, border: `1.5px solid ${s.border}`, borderRadius: 12, padding: '0.9rem 1rem', cursor: 'pointer', transition: 'box-shadow 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <i className={`fi ${s.icon}`} style={{ color: s.color, fontSize: '0.9rem' }} />
              <span style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 600 }}>{s.label}</span>
            </div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Budget utilisation + P&L detail */}
      <div className="grid-2" style={{ marginBottom: '1rem' }}>
        {budgetSum && (
          <div className="card">
            <div className="card-header">
              <span className="card-title"><i className="fi fi-rr-coin" style={{ marginRight: 6 }} />Budget {now.getFullYear()}</span>
              <button className="btn btn-outline btn-sm" onClick={() => navigate('/budget')} style={{ fontSize: '0.75rem' }}>Manage</button>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              {[
                { label: 'Budget',    value: formatETB(budgetSum.totalBudget),                        color: '#6b7280' },
                { label: 'Used',      value: formatETB(budgetSum.totalUsed),                          color: '#ef4444' },
                { label: 'Remaining', value: formatETB(budgetSum.totalBudget - budgetSum.totalUsed), color: '#22c55e' },
              ].map(m => (
                <div key={m.label} style={{ flex: 1, minWidth: 90 }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{m.label}</div>
                  <div style={{ fontWeight: 700, color: m.color, fontSize: '0.9rem' }}>{m.value}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, height: 8, background: '#e5e7eb', borderRadius: 4 }}>
                <div style={{ height: '100%', width: `${Math.min(budgetSum.utilizationPct || 0, 100)}%`, background: (budgetSum.utilizationPct || 0) > 90 ? '#ef4444' : '#22c55e', borderRadius: 4, transition: 'width 0.4s' }} />
              </div>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: (budgetSum.utilizationPct || 0) > 90 ? '#ef4444' : '#22c55e' }}>{Math.min(budgetSum.utilizationPct || 0, 100)}%</span>
            </div>
          </div>
        )}

        {pl && (
          <div className="card" style={{ borderLeft: `4px solid ${pl.isProfit ? '#22c55e' : '#ef4444'}` }}>
            <div className="card-header">
              <span className="card-title"><i className="fi fi-rr-chart-histogram" style={{ marginRight: 6 }} />Profit &amp; Loss</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, background: pl.isProfit ? '#dcfce7' : '#fee2e2', color: pl.isProfit ? '#166534' : '#991b1b', borderRadius: 20, padding: '2px 8px' }}>
                {pl.isProfit ? '▲' : '▼'} {Math.abs(pl.margin || 0)}%
              </span>
            </div>
            {[
              { label: 'Total Income',    value: pl.totalIncome,   color: '#22c55e' },
              { label: 'Total Expenses',  value: pl.totalExpenses, color: '#ef4444' },
              { label: 'Payroll Costs',   value: pl.totalPayroll,  color: '#f97316' },
              { label: pl.isProfit ? 'Net Profit' : 'Net Loss', value: Math.abs(pl.profitLoss || 0), color: pl.isProfit ? '#16a34a' : '#dc2626', bold: true },
            ].map(m => (
              <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px solid #f3f4f6', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>{m.label}</span>
                <span style={{ fontWeight: m.bold ? 800 : 600, color: m.color }}>{formatETB(m.value)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── SECTION 5: Approval Queues ── */}
      {(submittedPayrolls.length > 0 || submittedExpenses.length > 0) && (
        <div className="grid-2" style={{ marginBottom: '1rem' }}>
          {submittedPayrolls.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-title"><i className="fi fi-rr-money-check-edit" style={{ marginRight: 6 }} />Payroll Approvals</span>
                <span style={{ background: '#fef3c7', color: '#92400e', fontSize: '0.7rem', fontWeight: 700, borderRadius: 20, padding: '2px 8px' }}>{submittedPayrolls.length} pending</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: 180, overflowY: 'auto' }}>
                {submittedPayrolls.slice(0, 5).map(r => (
                  <div key={r._id || r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.35rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.82rem' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{r.employeeName}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{r.payPeriod} · {formatETB(r.netSalary)}</div>
                    </div>
                    <button className="btn btn-sm" style={{ background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', borderRadius: 5, padding: '2px 8px' }} onClick={() => handlePayrollApprove(r._id || r.id)} title="Approve"><i className="fi fi-rr-check" /></button>
                    <button className="btn btn-sm" style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 5, padding: '2px 8px' }} onClick={() => { setRejectPayrollId(r._id || r.id); setRejectReason(''); }} title="Reject"><i className="fi fi-rr-cross" /></button>
                  </div>
                ))}
              </div>
              <button className="btn btn-outline btn-sm" style={{ marginTop: 8, width: '100%' }} onClick={() => navigate('/payroll')}>View All Payroll</button>
            </div>
          )}

          {submittedExpenses.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-title"><i className="fi fi-rr-receipt" style={{ marginRight: 6 }} />Expense Approvals</span>
                <span style={{ background: '#fef3c7', color: '#92400e', fontSize: '0.7rem', fontWeight: 700, borderRadius: 20, padding: '2px 8px' }}>{submittedExpenses.length} pending</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: 180, overflowY: 'auto' }}>
                {submittedExpenses.slice(0, 5).map(e => (
                  <div key={e._id || e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.35rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.82rem' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{e.title}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{e.category} · {formatETB(e.amount)}</div>
                    </div>
                    <button className="btn btn-sm" style={{ background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', borderRadius: 5, padding: '2px 8px' }} onClick={() => handleExpenseApprove(e._id || e.id)} title="Approve"><i className="fi fi-rr-check" /></button>
                    <button className="btn btn-sm" style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 5, padding: '2px 8px' }} onClick={() => { setRejectExpenseId(e._id || e.id); setRejectReason(''); }} title="Reject"><i className="fi fi-rr-cross" /></button>
                  </div>
                ))}
              </div>
              <button className="btn btn-outline btn-sm" style={{ marginTop: 8, width: '100%' }} onClick={() => navigate('/expenses')}>View All Expenses</button>
            </div>
          )}
        </div>
      )}

      <QuickActions items={[
        { label: 'Farm Control',    icon: 'fi-rr-seedling',        action: () => navigate('/farm-control') },
        { label: 'Sensor Monitor',  icon: 'fi-rr-signal-alt',      action: () => navigate('/sensors') },
        { label: 'Irrigation',      icon: 'fi-rr-water-ladder',    action: () => navigate('/irrigation-schedule') },
        { label: 'Tasks',           icon: 'fi-rr-clipboard-list',  action: () => navigate('/tasks') },
        { label: 'Budget',          icon: 'fi-rr-coin',            action: () => navigate('/budget') },
        { label: 'Income',          icon: 'fi-rr-arrow-trend-up',  action: () => navigate('/income') },
        { label: 'Payroll',         icon: 'fi-rr-money-check-edit',action: () => navigate('/payroll') },
        { label: 'Reports',         icon: 'fi-rr-chart-histogram', action: () => navigate('/reports') },
        { label: 'User Management', icon: 'fi-rr-users-alt',       action: () => navigate('/users') },
      ]} />

      <div className="grid-2">
        <WaterChart data={waterChart} />
        <ActivityFeed items={activity} onRefresh={load} />
      </div>

      {/* Inline reject modals */}
      {(rejectPayrollId || rejectExpenseId) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '1.5rem', width: '100%', maxWidth: 380, boxShadow: '0 8px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginBottom: '0.8rem', fontWeight: 700 }}>
              <i className="fi fi-rr-cross-circle" style={{ marginRight: 8, color: '#ef4444' }} />
              Reject {rejectPayrollId ? 'Payroll' : 'Expense'}
            </h3>
            <div className="form-group">
              <label>Reason *</label>
              <textarea rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                placeholder="Reason for rejection…"
                style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.88rem', resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-outline" onClick={() => { setRejectPayrollId(null); setRejectExpenseId(null); setRejectReason(''); }}>Cancel</button>
              <button disabled={!rejectReason.trim()} style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, padding: '0.5rem 1rem', fontWeight: 700, cursor: rejectReason.trim() ? 'pointer' : 'not-allowed', opacity: rejectReason.trim() ? 1 : 0.5 }}
                onClick={rejectPayrollId ? handlePayrollReject : handleExpenseReject}>Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. ADMIN DASHBOARD — System Administrator
//    User management · Roles · Farm management · Device management · Reports
//    Admin is also an employee — shows own payslip status
// ══════════════════════════════════════════════════════════════════════════════
function AdminDashboard() {
  const { t }    = useLang();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary,    setSummary]    = useState(null);
  const [sensors,    setSensors]    = useState([]);
  const [zones,      setZones]      = useState([]);
  const [activity,   setActivity]   = useState([]);
  const [users,      setUsers]      = useState([]);
  const [myPayrolls, setMyPayrolls] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [actionMsg,  setActionMsg]  = useState('');
  const [controlling,setControlling]= useState(false);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [sum, sens, zns, act, usrs, myPay] = await Promise.all([
        dashboardApi.getSummary(),
        sensorApi.getAll().catch(() => []),
        zoneApi.getAll().catch(() => []),
        dashboardApi.getActivity(),
        userApi.getAll().catch(() => []),
        payrollApi.getMy().catch(() => []),
      ]);
      setSummary(sum);
      setSensors(Array.isArray(sens) ? sens : []);
      setZones(Array.isArray(zns) ? zns : []);
      setActivity(act);
      setUsers(Array.isArray(usrs) ? usrs : []);
      setMyPayrolls(Array.isArray(myPay) ? myPay.slice(0, 3) : []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleIrrigateAll = async () => {
    setControlling(true);
    try {
      const allActive = summary?.activeZones === summary?.totalZones;
      await zoneApi.controlAll(allActive ? 'stop' : 'start');
      setActionMsg(allActive ? 'Irrigation stopped.' : 'All zones irrigating.');
      await load();
    } catch (err) { setError(err.message); }
    finally { setControlling(false); }
  };

  if (loading) return <LoadingState />;
  const allActive = summary?.activeZones > 0 && summary?.activeZones === summary?.totalZones;
  const onlineSensors  = sensors.filter(s => s.online).length;
  const offlineSensors = sensors.filter(s => !s.online).length;
  const byRole = (r) => users.filter(u => u.role === r).length;
  const latestPay = myPayrolls[0] || null;

  return (
    <div>
      <div className="page-header">
        <h1>{t('welcomeBack')}, {user?.name?.split(' ')[0]}</h1>
        <div className="header-actions">
          <button className={`btn ${allActive ? 'btn-danger' : 'btn-primary'}`} onClick={handleIrrigateAll} disabled={controlling}>
            <i className={`fi ${allActive ? 'fi-rr-stop' : 'fi-rr-tint'}`} style={{ marginRight: 4 }} />
            {controlling ? t('loading') : allActive ? t('stopAll') : t('irrigateAll')}
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/users')}><i className="fi fi-rr-users-alt" style={{ marginRight: 4 }} />{t('users')}</button>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/sensors')}><i className="fi fi-rr-signal-alt" style={{ marginRight: 4 }} />{t('sensors')}</button>
          <button className="btn btn-outline btn-sm" onClick={load}><i className="fi fi-rr-refresh" /></button>
        </div>
      </div>

      {error     && <div className="alert alert-error"><i className="fi fi-rr-triangle-warning" style={{ marginRight: 6 }} />{error}</div>}
      {actionMsg && <div className="alert alert-success" style={{ marginBottom: '0.5rem' }}><i className="fi fi-rr-check" style={{ marginRight: 6 }} />{actionMsg}</div>}

      {/* System stats */}
      <div className="stats-grid">
        <StatCard icon="fi-rr-users-alt"      label={t('allUsers')}      value={users.length}            sub={t('active')}      onClick={() => navigate('/users')} />
        <StatCard icon="fi-rr-crown"          label={t('farmOwners')}    value={byRole('owner')}         sub={t('accounts')||'accounts'} />
        <StatCard icon="fi-rr-briefcase"      label={t('officeMgrs')}    value={byRole('office_manager')} sub={t('accounts')||'accounts'} />
        <StatCard icon="fi-rr-helmet-safety"  label={t('laborers')}      value={byRole('labor')}         sub={t('employees')} />
        <StatCard icon="fi-rr-signal-alt"     label={t('deviceOnline')}  value={onlineSensors}           sub={t('sensors')}  color={onlineSensors > 0 ? 'success' : 'danger'} onClick={() => navigate('/sensors')} />
        <StatCard icon="fi-rr-signal-alt-slash" label={t('deviceOffline')} value={offlineSensors}        sub={t('sensors')}  color={offlineSensors > 0 ? 'danger' : ''} />
        <StatCard icon="fi-rr-map-marker"     label={t('totalFarms')}    value={summary?.totalZones}     sub={t('farmControl')}  onClick={() => navigate('/farm-control')} />
        <StatCard icon="fi-rr-tint"           label={t('irrigating')}    value={summary?.activeZones}    sub={t('active')}   color={summary?.activeZones > 0 ? 'info' : ''} />
        <StatCard icon="fi-rr-clipboard-list" label={t('pending')}       value={(summary?.pendingTasks ?? 0) + (summary?.inProgressTasks ?? 0)} sub={t('tasks')} color={(summary?.pendingTasks ?? 0) > 0 ? 'danger' : ''} onClick={() => navigate('/tasks')} />
        <StatCard icon="fi-rr-check-circle"   label={t('completed')}     value={summary?.completedTasks ?? 0} sub={t('tasks')} color="success" onClick={() => navigate('/tasks')} />
      </div>

      {/* Device status */}
      {sensors.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-header">
            <span className="card-title"><i className="fi fi-rr-signal-alt" style={{ marginRight: 6 }} />Device Status</span>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/sensors')}><i className="fi fi-rr-arrow-right" style={{ marginRight: 4 }} />All Devices</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.5rem' }}>
            {sensors.slice(0, 4).map(s => <SensorCard key={s._id || s.id} s={s} />)}
          </div>
        </div>
      )}

      {/* Farm zones */}
      {zones.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-header">
            <span className="card-title"><i className="fi fi-rr-seedling" style={{ marginRight: 6 }} />Farm Management</span>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/farm-control')}>Manage</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.4rem' }}>
            {zones.slice(0, 6).map(z => (
              <div key={z._id || z.id} style={{ padding: '0.5rem 0.8rem', borderRadius: 8, background: z.active ? '#f0fdf4' : '#f9fafb', border: `1px solid ${z.active ? '#86efac' : '#e5e7eb'}`, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem' }}>
                <i className="fi fi-rr-map-marker" style={{ color: z.active ? '#16a34a' : '#9ca3af' }} />
                <span style={{ flex: 1, fontWeight: 600 }}>{z.name}</span>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: z.active ? '#166534' : '#6b7280' }}>{z.active ? 'ON' : 'OFF'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My Payslip — Admin is an employee */}
      <div className="grid-2" style={{ marginBottom: '1rem' }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title"><i className="fi fi-rr-money-check-edit" style={{ marginRight: 6, color: '#0891b2' }} />My Payroll</span>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/payroll')} style={{ fontSize: '0.75rem' }}>View All</button>
          </div>
          {latestPay ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{latestPay.payPeriod}</span>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, background: PAYROLL_COLOR[latestPay.status] + '22', color: PAYROLL_COLOR[latestPay.status], border: `1px solid ${PAYROLL_COLOR[latestPay.status]}44`, borderRadius: 20, padding: '2px 8px', textTransform: 'capitalize' }}>
                  {latestPay.status}
                </span>
              </div>
              <div style={{ fontWeight: 800, fontSize: '1.3rem', color: '#16a34a', marginBottom: 4 }}>{formatETB(latestPay.netSalary)}</div>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <span>Gross: {formatETB(latestPay.grossSalary)}</span>
                <span>Tax: {formatETB(latestPay.incomeTax)}</span>
                <span>Pension: {formatETB(latestPay.pensionEmployee)}</span>
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>{t('noPayrollYet')}</p>
          )}
        </div>

        {/* User role breakdown */}
        {users.length > 0 && (
          <div className="card">
            <div className="card-header">
              <span className="card-title"><i className="fi fi-rr-users-alt" style={{ marginRight: 6 }} />User Accounts</span>
              <button className="btn btn-outline btn-sm" onClick={() => navigate('/users')}>Manage Users</button>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {users.slice(0, 6).map(u => (
                <div key={u._id || u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.4rem 0.75rem', borderRadius: 8, background: '#f9fafb', border: '1px solid var(--border)', fontSize: '0.8rem' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem', color: '#374151' }}>
                    {u.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{u.name}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{u.role?.replace('_', ' ')}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <QuickActions items={[
        { label: 'User Management',   icon: 'fi-rr-users-alt',       action: () => navigate('/users') },
        { label: 'Farm Management',   icon: 'fi-rr-seedling',        action: () => navigate('/farm-control') },
        { label: 'Sensors & Devices', icon: 'fi-rr-signal-alt',      action: () => navigate('/sensors') },
        { label: 'Irrigation Control',icon: 'fi-rr-water-ladder',    action: () => navigate('/irrigation-schedule') },
        { label: 'Task Management',   icon: 'fi-rr-clipboard-list',  action: () => navigate('/tasks') },
        { label: 'My Payroll',        icon: 'fi-rr-money-check-edit',action: () => navigate('/payroll') },
        { label: 'Reports',           icon: 'fi-rr-chart-histogram', action: () => navigate('/reports') },
        { label: 'Notifications',     icon: 'fi-rr-bell',            action: () => navigate('/notifications') },
      ]} />

      <ActivityFeed items={activity} onRefresh={load} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. OFFICE MANAGER DASHBOARD
//    Employees · Tasks · Attendance · Expenses · Payroll · Reports
// ══════════════════════════════════════════════════════════════════════════════
function OfficeManagerDashboard() {
  const { t }    = useLang();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary,    setSummary]    = useState(null);
  const [activity,   setActivity]   = useState([]);
  const [payrolls,   setPayrolls]   = useState([]);
  const [payrollSum, setPayrollSum] = useState(null);
  const [expenseSum, setExpenseSum] = useState(null);
  const [expenses,   setExpenses]   = useState([]);
  const [attSummary, setAttSummary] = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [actionMsg,  setActionMsg]  = useState('');

  const now    = new Date();
  const month  = now.getMonth() + 1;
  const year   = now.getFullYear();
  const period = `${year}-${String(month).padStart(2, '0')}`;

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [sum, act, payData, att, paySum, expSum, expPending] = await Promise.all([
        dashboardApi.getSummary(),
        dashboardApi.getActivity(),
        payrollApi.getAll({ payPeriod: period, limit: 20 }).catch(() => ({ records: [] })),
        attendanceApi.getSummary(month, year).catch(() => null),
        payrollApi.getSummary(period).catch(() => null),
        expenseApi.getSummary().catch(() => null),
        expenseApi.getAll({ status: 'draft', limit: 10 }).catch(() => ({ expenses: [] })),
      ]);
      setSummary(sum);
      setActivity(act);
      setPayrolls(payData?.records || []);
      setAttSummary(att);
      setPayrollSum(paySum);
      setExpenseSum(expSum);
      setExpenses(expPending?.expenses || []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handlePayrollSubmit = async (id) => {
    try { await payrollApi.submit(id); setActionMsg('Payroll submitted for Owner approval!'); load(); }
    catch (e) { setError(e.message); }
  };

  if (loading) return <LoadingState />;

  const draftPayrolls = payrolls.filter(p => p.status === 'draft');
  const submittedPayrolls = payrolls.filter(p => p.status === 'submitted');

  return (
    <div>
      <div className="page-header">
        <h1>{t('welcomeBack')}, {user?.name?.split(' ')[0]}</h1>
        <div className="header-actions">
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/employees')}><i className="fi fi-rr-users-alt" style={{ marginRight: 4 }} />{t('employees')}</button>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/attendance')}><i className="fi fi-rr-user-time" style={{ marginRight: 4 }} />{t('attendance')}</button>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/payroll')}><i className="fi fi-rr-money-check-edit" style={{ marginRight: 4 }} />{t('payroll')}</button>
          <button className="btn btn-outline btn-sm" onClick={load}><i className="fi fi-rr-refresh" /></button>
        </div>
      </div>

      {error     && <div className="alert alert-error"><i className="fi fi-rr-triangle-warning" style={{ marginRight: 6 }} />{error}</div>}
      {actionMsg && <div className="alert alert-success" style={{ marginBottom: '0.5rem' }}><i className="fi fi-rr-check" style={{ marginRight: 6 }} />{actionMsg}</div>}

      {/* HR Stats */}
      <div className="stats-grid">
        <StatCard icon="fi-rr-users-alt"      label={t('totalEmployeesLabel')} value={summary?.totalUsers ?? 0}      sub={t('active')}      onClick={() => navigate('/employees')} />
        <StatCard icon="fi-rr-helmet-safety"  label={t('laborers')}            value={summary?.laborCount ?? 0}      sub={t('employees')}   color="info"    onClick={() => navigate('/employees')} />
        <StatCard icon="fi-rr-user-time"      label={t('present')}             value={attSummary?.present ?? '—'}    sub={t('checkIn')}     color="success" onClick={() => navigate('/attendance')} />
        <StatCard icon="fi-rr-user-remove"    label={t('absent')}              value={attSummary?.absent ?? '—'}     sub={t('absent')}      color={attSummary?.absent > 0 ? 'danger' : ''} onClick={() => navigate('/attendance')} />
        <StatCard icon="fi-rr-clipboard-list" label={t('pending')}             value={summary?.pendingTasks ?? 0}    sub={t('tasks')}       color={summary?.pendingTasks > 0 ? 'danger' : ''} onClick={() => navigate('/tasks')} badge={summary?.pendingTasks} />
        <StatCard icon="fi-rr-spinner"        label={t('inProgress')}          value={summary?.inProgressTasks ?? 0} sub={t('tasks')}       color="info"    onClick={() => navigate('/tasks')} />
        <StatCard icon="fi-rr-check-circle"   label={t('completed')}           value={summary?.completedTasks ?? 0}  sub={t('tasks')}       color="success" onClick={() => navigate('/tasks')} />
      </div>

      {/* ── Finance Overview Row ── */}
      <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="fi fi-rr-coins" style={{ color: '#166534' }} /> {t('budget')} — {now.toLocaleString('default', { month: 'long' })} {year}
        </h3>
        <button className="btn btn-outline btn-sm" onClick={() => navigate('/payroll')} style={{ fontSize: '0.78rem' }}>
          <i className="fi fi-rr-money-check-edit" style={{ marginRight: 4 }} />{t('payroll')}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
        {[
          { icon: 'fi-rr-money-check-edit', label: 'Total Payroll',    value: formatETB(payrollSum?.totalNet    ?? 0), color: '#0891b2', bg: '#eff6ff', border: '#bfdbfe', onClick: () => navigate('/payroll') },
          { icon: 'fi-rr-coins',            label: 'Gross Payroll',    value: formatETB(payrollSum?.totalGross  ?? 0), color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', onClick: () => navigate('/payroll') },
          { icon: 'fi-rr-paper-plane',      label: 'Submitted',        value: submittedPayrolls.length + ' records',  color: '#f59e0b', bg: '#fffbeb', border: '#fcd34d', onClick: () => navigate('/payroll') },
          { icon: 'fi-rr-receipt',          label: 'Total Expenses',   value: formatETB(expenseSum?.totalAmount ?? 0), color: '#ef4444', bg: '#fef2f2', border: '#fca5a5', onClick: () => navigate('/expenses') },
          { icon: 'fi-rr-clock',            label: 'Pending Expenses', value: formatETB(expenseSum?.pending     ?? 0), color: '#c2410c', bg: '#fff7ed', border: '#fed7aa', onClick: () => navigate('/expenses') },
        ].map(s => (
          <div key={s.label} onClick={s.onClick}
            style={{ background: s.bg, border: `1.5px solid ${s.border}`, borderRadius: 12, padding: '0.85rem 1rem', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <i className={`fi ${s.icon}`} style={{ color: s.color, fontSize: '0.88rem' }} />
              <span style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 600 }}>{s.label}</span>
            </div>
            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Attendance summary */}
      {attSummary && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-header">
            <span className="card-title"><i className="fi fi-rr-user-time" style={{ marginRight: 6 }} />Attendance — {now.toLocaleString('default', { month: 'long' })} {year}</span>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/attendance')}>View All</button>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {[
              { label: 'Present',  value: attSummary.present || 0, color: '#22c55e' },
              { label: 'Absent',   value: attSummary.absent  || 0, color: '#ef4444' },
              { label: 'Leave',    value: attSummary.leave   || 0, color: '#f59e0b' },
              { label: 'Late',     value: attSummary.late    || 0, color: '#f97316' },
              { label: 'Overtime', value: `${attSummary.totalOvertimeHours ?? 0}h`, color: '#3b82f6' },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, minWidth: 80, textAlign: 'center', padding: '0.6rem', background: `${s.color}10`, borderRadius: 8, border: `1px solid ${s.color}30` }}>
                <div style={{ fontWeight: 800, fontSize: '1.4rem', color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payroll drafts — ready to submit */}
      {draftPayrolls.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-header">
            <span className="card-title"><i className="fi fi-rr-money-check-edit" style={{ marginRight: 6 }} />Payroll Drafts — {now.toLocaleString('default', { month: 'long' })} {year}</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ background: '#fef3c7', color: '#92400e', fontSize: '0.7rem', fontWeight: 700, borderRadius: 20, padding: '2px 8px' }}>{draftPayrolls.length} draft{draftPayrolls.length > 1 ? 's' : ''}</span>
              <button className="btn btn-outline btn-sm" onClick={() => navigate('/payroll')}>View All</button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: 200, overflowY: 'auto' }}>
            {draftPayrolls.slice(0, 6).map(p => (
              <div key={p._id || p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.4rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.82rem' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600 }}>{p.employeeName}</span>
                  <span style={{ marginLeft: 8, fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{(p.employeeRole || '').replace('_', ' ')}</span>
                </div>
                <span style={{ fontWeight: 700, color: '#16a34a', marginRight: 6 }}>{formatETB(p.netSalary)}</span>
                <button className="btn btn-sm" style={{ background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', padding: '2px 10px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700 }}
                  onClick={() => handlePayrollSubmit(p._id || p.id)}>
                  <i className="fi fi-rr-paper-plane" style={{ marginRight: 3 }} />Submit
                </button>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8, padding: '0.4rem 0', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Total ({draftPayrolls.length} drafts)</span>
            <strong style={{ color: '#16a34a' }}>{formatETB(draftPayrolls.reduce((s, p) => s + (p.netSalary || 0), 0))}</strong>
          </div>
        </div>
      )}

      <QuickActions items={[
        { label: 'Attendance', icon: 'fi-rr-user-time',        action: () => navigate('/attendance') },
        { label: 'Payroll',    icon: 'fi-rr-money-check-edit', action: () => navigate('/payroll') },
        { label: 'Expenses',   icon: 'fi-rr-receipt',          action: () => navigate('/expenses') },
        { label: 'Tasks',      icon: 'fi-rr-clipboard-list',   action: () => navigate('/tasks') },
        { label: 'Reports',    icon: 'fi-rr-chart-histogram',  action: () => navigate('/reports') },
      ]} />

      <ActivityFeed items={activity} onRefresh={load} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. LABOR DASHBOARD — Field Worker
//    My tasks · Attendance · Assigned farm · Payroll
// ══════════════════════════════════════════════════════════════════════════════
function LaborDashboard() {
  const { t }    = useLang();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary,    setSummary]    = useState(null);
  const [myTasks,    setMyTasks]    = useState([]);
  const [zones,      setZones]     = useState([]);
  const [myPayrolls, setMyPayrolls] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [actionMsg,  setActionMsg]  = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [sum, tasks, z, pay] = await Promise.all([
        dashboardApi.getSummary().catch(() => null),
        taskApi.getAll().catch(() => []),
        zoneApi.getAll().catch(() => []),
        payrollApi.getMy().catch(() => []),
      ]);
      setSummary(sum);
      setMyTasks(Array.isArray(tasks) ? tasks : []);
      setZones(Array.isArray(z) ? z : []);
      setMyPayrolls(Array.isArray(pay) ? pay : []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleStatusUpdate = async (task, newStatus) => {
    try {
      await taskApi.updateStatus(task._id || task.id, newStatus);
      setActionMsg(`Task marked as ${newStatus.replace('_', ' ').toUpperCase()}.`);
      load();
    } catch (e) { setError(e.message); }
  };

  if (loading) return <LoadingState />;

  const pending    = myTasks.filter(t => t.status === 'pending').length;
  const inProgress = myTasks.filter(t => t.status === 'in_progress').length;
  const completed  = myTasks.filter(t => t.status === 'completed').length;

  const att = summary?.attendanceSummary || { presentDays: 0, absentDays: 0, leaveDays: 0, overtimeHours: 0 };
  const pay = summary?.payrollSummary || (myPayrolls.length > 0 ? myPayrolls[0] : null);
  const pr  = summary?.problemReportSummary || { open: 0, inReview: 0, resolved: 0 };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem' }}>
            {t('welcomeBack')}, {user?.name?.split(' ')[0]} 🧑‍🌾
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '4px 0 0' }}>
            {t('dashboardSubtitle')}
          </p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/problem-reports')} style={{ background: '#ef4444', borderColor: '#ef4444' }}>
            <i className="fi fi-rr-triangle-warning" style={{ marginRight: 6 }} />{t('reportProblem')}
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/tasks')}>
            <i className="fi fi-rr-clipboard-list" style={{ marginRight: 6 }} />My Tasks ({pending + inProgress})
          </button>
          <button className="btn btn-outline btn-sm" onClick={load}>
            <i className="fi fi-rr-refresh" />
          </button>
        </div>
      </div>

      {error     && <div className="alert alert-error"><i className="fi fi-rr-triangle-warning" style={{ marginRight: 6 }} />{error}</div>}
      {actionMsg && <div className="alert alert-success" style={{ marginBottom: '0.8rem' }}><i className="fi fi-rr-check" style={{ marginRight: 6 }} />{actionMsg}</div>}

      {/* Today's Tasks Metrics */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: 10, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="fi fi-rr-clipboard-list" style={{ color: 'var(--primary)' }} />
          Today's Tasks Breakdown
        </h3>
        <div className="stats-grid">
          <StatCard icon="fi-rr-clipboard-list" label={t('myTasks')}    value={summary?.todayTasks?.total ?? myTasks.length}         sub={t('tasks')}   onClick={() => navigate('/tasks')} />
          <StatCard icon="fi-rr-clock"          label={t('pending')}    value={summary?.todayTasks?.pending ?? pending}               sub={t('tasks')}   color={pending > 0 ? 'warning' : ''} onClick={() => navigate('/tasks')} badge={pending} />
          <StatCard icon="fi-rr-spinner"        label={t('inProgress')} value={summary?.todayTasks?.inProgress ?? inProgress}         sub={t('tasks')}   color={inProgress > 0 ? 'info' : ''} onClick={() => navigate('/tasks')} />
          <StatCard icon="fi-rr-check-circle"   label={t('completed')}  value={summary?.todayTasks?.completed ?? completed}           sub={t('tasks')}   color="success" onClick={() => navigate('/tasks')} />
        </div>
      </div>

      {/* Main Grid: Left Column (Tasks & Irrigation), Right Column (Attendance & Payroll) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.2rem', marginBottom: '1.5rem' }}>
        
        {/* Left Column: Tasks List & Next Task */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          
          {/* Priority Next Task Banner */}
          {summary?.nextTask && (
            <div style={{ background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', color: '#fff', padding: '1.2rem', borderRadius: 12, boxShadow: '0 4px 12px rgba(59,130,246,0.2)' }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', tracking: 1, color: '#93c5fd', fontWeight: 700, marginBottom: 4 }}>
                ⚡ Next Priority Task
              </div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>{summary.nextTask.title}</h3>
              {summary.nextTask.zone && <div style={{ fontSize: '0.8rem', color: '#bfdbfe', marginTop: 2 }}>📍 Location: {summary.nextTask.zone}</div>}
              {summary.nextTask.instructions && <div style={{ fontSize: '0.82rem', background: 'rgba(255,255,255,0.15)', padding: '6px 10px', borderRadius: 6, marginTop: 8 }}>{summary.nextTask.instructions}</div>}
              <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                {summary.nextTask.status === 'pending' ? (
                  <button className="btn btn-sm" style={{ background: '#fff', color: '#1e3a8a', fontWeight: 700, border: 'none' }} onClick={() => handleStatusUpdate(summary.nextTask, 'in_progress')}>
                    Start Task Now →
                  </button>
                ) : (
                  <button className="btn btn-sm" style={{ background: '#22c55e', color: '#fff', fontWeight: 700, border: 'none' }} onClick={() => handleStatusUpdate(summary.nextTask, 'completed')}>
                    Mark Completed ✓
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Assigned Tasks List */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="card-title"><i className="fi fi-rr-clipboard-list" style={{ marginRight: 6, color: 'var(--primary)' }} />My Assigned Tasks</span>
              <button className="btn btn-outline btn-sm" onClick={() => navigate('/tasks')}>View All</button>
            </div>
            {myTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                ✅ No tasks assigned at the moment.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {myTasks.slice(0, 5).map(task => (
                  <div key={task._id || task.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '0.6rem', background: '#f9fafb', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORITY_COLOR[task.priority] || '#6b7280', flexShrink: 0, marginTop: 6 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text)' }}>{task.title}</div>
                      {task.zone && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Zone: {task.zone}</div>}
                      {task.instructions && <div style={{ fontSize: '0.78rem', color: '#374151', marginTop: 3 }}>{task.instructions}</div>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, background: `${STATUS_COLOR[task.status]}22`, color: STATUS_COLOR[task.status], border: `1px solid ${STATUS_COLOR[task.status]}44`, borderRadius: 20, padding: '1px 8px' }}>
                        {STATUS_LABEL[task.status] || task.status}
                      </span>
                      {task.status === 'pending'     && <button className="btn btn-sm" style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 5, padding: '2px 8px', fontSize: '0.72rem' }} onClick={() => handleStatusUpdate(task, 'in_progress')}>Start</button>}
                      {task.status === 'in_progress' && <button className="btn btn-sm" style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #86efac', borderRadius: 5, padding: '2px 8px', fontSize: '0.72rem' }} onClick={() => handleStatusUpdate(task, 'completed')}>Complete</button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Attendance Summary, Payroll Summary & Problem Report */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          
          {/* Monthly Attendance Summary Card */}
          <div className="card" style={{ background: '#fff' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="card-title"><i className="fi fi-rr-user-time" style={{ marginRight: 6, color: '#0891b2' }} />Monthly Attendance Summary</span>
              <button className="btn btn-outline btn-sm" onClick={() => navigate('/attendance')}>Details</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginTop: 6 }}>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '0.8rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 600 }}>Present Days</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#15803d', marginTop: 2 }}>{att.presentDays} days</div>
              </div>
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '0.8rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: '#991b1b', fontWeight: 600 }}>Absent Days</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#dc2626', marginTop: 2 }}>{att.absentDays} days</div>
              </div>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '0.8rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: 600 }}>Leave Days</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#2563eb', marginTop: 2 }}>{att.leaveDays} days</div>
              </div>
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '0.8rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: '#92400e', fontWeight: 600 }}>Overtime</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#d97706', marginTop: 2 }}>{att.overtimeHours} hrs</div>
              </div>
            </div>
          </div>

          {/* Latest Payroll Summary Card */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="card-title"><i className="fi fi-rr-money-check-edit" style={{ marginRight: 6, color: '#16a34a' }} />My Payroll Status</span>
              <button className="btn btn-outline btn-sm" onClick={() => navigate('/payroll')}>View Payroll</button>
            </div>
            {pay ? (
              <div style={{ padding: '0.8rem', background: '#f8fafc', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Period: {pay.payPeriod}</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, background: pay.status === 'paid' ? '#dcfce7' : '#fef3c7', color: pay.status === 'paid' ? '#166534' : '#92400e', padding: '2px 8px', borderRadius: 20 }}>
                    {pay.status ? pay.status.toUpperCase() : 'PENDING'}
                  </span>
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#16a34a', margin: '8px 0 4px' }}>
                  {formatETB(pay.netSalary)}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Bank: Commercial Bank of Ethiopia (CBE)</span>
                  <span>Ref: {pay.paymentRefMasked || '****1234'}</span>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No payroll record available for this period.
              </div>
            )}
          </div>

          {/* Problem Reporting Shortcut Banner */}
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', padding: '1rem', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, color: '#991b1b', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fi fi-rr-triangle-warning" /> Report Irrigation / Farm Problem
              </div>
              <div style={{ fontSize: '0.78rem', color: '#7f1d1d', marginTop: 2 }}>
                Report pump issues, pipe leakage, or low water levels immediately.
              </div>
            </div>
            <button
              className="btn btn-sm"
              onClick={() => navigate('/problem-reports')}
              style={{ background: '#dc2626', color: '#fff', border: 'none', fontWeight: 600, padding: '0.5rem 0.9rem', borderRadius: 8, whiteSpace: 'nowrap' }}
            >
              Report Now →
            </button>
          </div>

        </div>

      </div>

      <QuickActions items={[
        { label: 'My Tasks',      icon: 'fi-rr-clipboard-list', action: () => navigate('/tasks') },
        { label: 'My Attendance', icon: 'fi-rr-user-time',      action: () => navigate('/attendance') },
        { label: 'Irrigation',    icon: 'fi-rr-tint',           action: () => navigate('/irrigation-schedule') },
        { label: 'Report Issue',  icon: 'fi-rr-triangle-warning',action: () => navigate('/problem-reports') },
        { label: 'My Payroll',    icon: 'fi-rr-money-check-edit',action: () => navigate('/payroll') },
        { label: 'My Profile',    icon: 'fi-rr-user',           action: () => navigate('/profile') },
      ]} />
    </div>
  );
}
