/**
 * Payroll Management
 * Design: matches the professional payroll dashboard from the reference image.
 *
 * Roles:
 *  Office Manager  — New entry, edit, delete, bulk generate, submit
 *  Owner           — Review, approve, reject, mark paid
 *  Admin           — Read-only (own payslip via /my route)
 *  Labor           — Redirected to MyPayrollPage (own payslips only)
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { payrollApi, employeeApi, formatETB } from '../services/api';

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUS_META = {
  draft:     { label: 'Draft',     bg: '#f3f4f6', color: '#6b7280', dot: '#9ca3af' },
  submitted: { label: 'Submitted', bg: '#fef9c3', color: '#92400e', dot: '#f59e0b' },
  approved:  { label: 'Approved',  bg: '#dbeafe', color: '#1e40af', dot: '#3b82f6' },
  paid:      { label: 'Paid',      bg: '#dcfce7', color: '#166534', dot: '#22c55e' },
  rejected:  { label: 'Rejected',  bg: '#fee2e2', color: '#991b1b', dot: '#ef4444' },
};

const ROLE_LABEL = { admin: 'Admin', office_manager: 'Office Manager', labor: 'Laborer' };

function calcTax(gross) {
  if (gross <= 600)   return 0;
  if (gross <= 1650)  return +((gross - 600) * 0.10).toFixed(2);
  if (gross <= 3200)  return +(105 + (gross - 1650) * 0.15).toFixed(2);
  if (gross <= 5250)  return +(337.5 + (gross - 3200) * 0.20).toFixed(2);
  if (gross <= 7800)  return +(747.5 + (gross - 5250) * 0.25).toFixed(2);
  if (gross <= 10900) return +(1385 + (gross - 7800) * 0.30).toFixed(2);
  return +(2315 + (gross - 10900) * 0.35).toFixed(2);
}

function calcPreview(f) {
  const base  = parseFloat(f.baseSalary    || 0);
  const ot    = parseFloat(f.overtimePay   || 0);
  const bonus = parseFloat(f.bonus         || 0);
  const allow = parseFloat(f.allowance     || 0);
  const other = parseFloat(f.otherEarnings || 0);
  const gross = base + ot + bonus + allow + other;
  const pension  = +(base * 0.07).toFixed(2);
  const tax      = calcTax(gross);
  const unpaid   = parseFloat(f.unpaidDays      || 0);
  const otherDed = parseFloat(f.otherDeductions || 0);
  const totalDed = +(pension + tax + unpaid + otherDed).toFixed(2);
  const net      = +(gross - totalDed).toFixed(2);
  return { gross: +gross.toFixed(2), pension, tax, totalDed, net };
}

const EMPTY_FORM = {
  employeeId: '', payPeriod: '',
  baseSalary: '', overtimePay: '0', bonus: '0',
  allowance: '0', otherEarnings: '0',
  unpaidDays: '0', otherDeductions: '0', notes: '',
};

function periodLabel(p) {
  if (!p) return '';
  const [yr, mo] = p.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(mo, 10) - 1] || mo} ${yr}`;
}

function exportToCSV(records, period) {
  const headers = ['Employee','Role','Period','Base','Bonus','Deductions','Net Pay','Days','Hours','Status'];
  const rows = records.map(r => [
    r.employeeName,
    (r.employeeRole || '').replace('_', ' '),
    r.payPeriod,
    r.baseSalary || 0,
    r.bonus || 0,
    r.totalDeductions || 0,
    r.netSalary || 0,
    r.presentDays || 0,
    r.overtimeHours || 0,
    r.status,
  ]);
  const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `payroll-${period || 'export'}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Payroll() {
  const { user } = useAuth();
  const navigate   = useNavigate();
  const role       = user?.role;
  const isLabor    = role === 'labor';
  const isAdmin    = role === 'admin';

  // Labor and Admin must use MyPayrollPage — they cannot access the payroll management table
  useEffect(() => {
    if (isLabor || isAdmin) navigate('/my-payroll', { replace: true });
  }, [isLabor, isAdmin, navigate]);

  // Don't render anything while redirecting
  if (isLabor || isAdmin) return null;

  const canCreate  = ['office_manager', 'owner'].includes(role);
  const canSubmit  = ['office_manager', 'owner'].includes(role);
  const canApprove = role === 'owner';
  const canPay     = role === 'office_manager';
  const canDelete  = role === 'owner'; // only owner can permanently delete

  const now = new Date();
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [records,   setRecords]   = useState([]);
  const [employees, setEmployees] = useState([]);
  const [summary,   setSummary]   = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');

  // Filters
  const [filterPeriod,   setFilterPeriod]   = useState(defaultPeriod);
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterStatus,   setFilterStatus]   = useState('');

  // Modals
  const [showForm,    setShowForm]    = useState(false);
  const [editRecord,  setEditRecord]  = useState(null);
  const [showDetail,  setShowDetail]  = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason,setRejectReason]= useState('');
  const [payModal,    setPayModal]    = useState(null);
  const [empInfo,     setEmpInfo]     = useState(null);  // employee HR record for pay modal
  const [empLoading,  setEmpLoading]  = useState(false);
  const [paying,      setPaying]      = useState(false);
  const [payResult,   setPayResult]   = useState(null);
  const [bulkPaying,  setBulkPaying]  = useState(false);

  // Form
  const [form, setForm] = useState(EMPTY_FORM);
  const fv = calcPreview(form);

  // ── Data loading ─────────────────────────────────────────────────────────────
  const load = async () => {
    setLoading(true); setError('');
    try {
      const params = { payPeriod: filterPeriod };
      if (filterEmployee) params.employeeId = filterEmployee;
      if (filterStatus)   params.status     = filterStatus;
      const [res, sum] = await Promise.all([
        payrollApi.getAll(params),
        payrollApi.getSummary(filterPeriod),
      ]);
      setRecords(res?.records || []);
      setSummary(sum);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filterPeriod, filterEmployee, filterStatus, role]);

  useEffect(() => {
    if (canCreate) {
      employeeApi.getAll({ isActive: true })
        .then(r => setEmployees(r?.employees || []))
        .catch(() => {});
    }
  }, [canCreate]);

  // ── Actions ───────────────────────────────────────────────────────────────────
  const toast = (msg, isErr = false) => {
    isErr ? setError(msg) : setSuccess(msg);
    setTimeout(() => isErr ? setError('') : setSuccess(''), 3500);
  };

  const openCreate = () => {
    setEditRecord(null);
    setForm({ ...EMPTY_FORM, payPeriod: filterPeriod });
    setShowForm(true);
  };

  const openEdit = (r) => {
    setEditRecord(r);
    setForm({
      employeeId:     r.employeeId,
      payPeriod:      r.payPeriod,
      baseSalary:     String(r.baseSalary    || 0),
      overtimePay:    String(r.overtimePay   || 0),
      bonus:          String(r.bonus         || 0),
      allowance:      String(r.allowance     || 0),
      otherEarnings:  String(r.otherEarnings || 0),
      unpaidDays:     String(r.unpaidDays    || 0),
      otherDeductions:String(r.otherDeductions || 0),
      notes:          r.notes || '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.employeeId) { toast('Employee is required.', true); return; }
    if (!form.payPeriod)  { toast('Pay period is required.', true); return; }
    if (!form.baseSalary || parseFloat(form.baseSalary) <= 0) { toast('Base salary is required.', true); return; }
    setSaving(true);
    try {
      if (editRecord) {
        await payrollApi.update(editRecord._id || editRecord.id, form);
        toast('Payroll record updated.');
      } else {
        await payrollApi.create(form);
        toast('Payroll record created.');
      }
      setShowForm(false); load();
    } catch (e) { toast(e.message, true); }
    finally { setSaving(false); }
  };

  const handleBulk = async () => {
    if (!window.confirm(`Generate payroll for all active employees for ${periodLabel(filterPeriod)} (${filterPeriod})?`)) return;
    setSaving(true);
    try {
      const res = await payrollApi.createBulk(filterPeriod);
      toast(`Bulk done — ${res.created?.length || 0} created, ${res.skipped?.length || 0} skipped.`);
      load();
    } catch (e) { toast(e.message, true); }
    finally { setSaving(false); }
  };

  const act = async (fn, id, ...args) => {
    setSaving(true);
    try { await fn(id, ...args); toast('Done.'); load(); }
    catch (e) { toast(e.message, true); }
    finally { setSaving(false); }
  };

  const handleDelete = async (r) => {
    if (!window.confirm(`Delete payroll for ${r.employeeName} (${r.payPeriod})?`)) return;
    setSaving(true);
    try { await payrollApi.remove(r._id || r.id); toast('Record deleted.'); load(); }
    catch (e) { toast(e.message, true); }
    finally { setSaving(false); }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { toast('Reason is required.', true); return; }
    setSaving(true);
    try {
      await payrollApi.reject(rejectModal._id || rejectModal.id, rejectReason);
      toast('Payroll rejected.');
      setRejectModal(null); setRejectReason(''); load();
    } catch (e) { toast(e.message, true); }
    finally { setSaving(false); }
  };

  const handlePayWithChapa = async () => {
    if (!payModal) return;
    setPaying(true); setPayResult(null);
    try {
      const res = await payrollApi.chapaCheckout(payModal._id || payModal.id);

      // Open Chapa checkout in a new tab with noopener so it gets a fresh
      // browser context — prevents Chapa dashboard redirect for logged-in users.
      const chapaTab = window.open(res.checkoutUrl, '_blank', 'noopener,noreferrer');

      if (!chapaTab) {
        // Popup blocked — fall back to same-tab redirect
        window.location.href = res.checkoutUrl;
        return;
      }

      // Poll every 3 s to detect when payment is completed
      // (Chapa redirects back to /payment/success which calls verify and marks paid)
      const payrollId = payModal._id || payModal.id;
      const poll = setInterval(async () => {
        try {
          const updated = await payrollApi.getOne(payrollId);
          if (updated?.status === 'paid') {
            clearInterval(poll);
            setPaying(false);
            setPayModal(null);
            setPayResult(null);
            load(); // refresh table
            toast(`✅ Salary paid to ${updated.employeeName} — ETB ${updated.netSalary?.toLocaleString()}`);
          }
        } catch (_) { /* keep polling */ }
      }, 3000);

      // Stop polling after 15 min regardless
      setTimeout(() => { clearInterval(poll); setPaying(false); }, 15 * 60 * 1000);

    } catch (e) {
      setPayResult({ success: false, message: e.message });
      setPaying(false);
    }
  };

  const handleBulkPay = async () => {
    const approvedCount = records.filter(r => r.status === 'approved').length;
    if (approvedCount === 0) { toast('No approved payrolls to pay for this period.', true); return; }
    if (!window.confirm(`Pay ${approvedCount} approved employee(s) for ${periodLabel(filterPeriod)} via Chapa?\n\nThis will initiate real bank transfers to employees. Continue?`)) return;
    setBulkPaying(true);
    try {
      const res = await payrollApi.bulkPay(filterPeriod);
      toast(`Bulk payment done: ${res.paid?.length || 0} paid${res.missing?.length ? `, ${res.missing.length} skipped (missing Chapa bank info)` : ''}.`);
      load();
    } catch (e) { toast(e.message, true); }
    finally { setBulkPaying(false); }
  };

  // ── Derived summary numbers ───────────────────────────────────────────────────
  const totalPayroll = records.reduce((s, r) => s + (r.netSalary || 0), 0);
  const pendingPay   = records.filter(r => ['draft','submitted','approved'].includes(r.status)).reduce((s, r) => s + (r.netSalary || 0), 0);
  const paidOut      = records.filter(r => r.status === 'paid').reduce((s, r) => s + (r.netSalary || 0), 0);
  const workerCount  = new Set(records.map(r => String(r.employeeId))).size;

  const filtered = records.filter(r =>
    (!filterEmployee || String(r.employeeId) === filterEmployee) &&
    (!filterStatus   || r.status === filterStatus)
  );

  // Totals row
  const totBase   = filtered.reduce((s, r) => s + (r.baseSalary    || 0), 0);
  const totBonus  = filtered.reduce((s, r) => s + (r.bonus         || 0), 0);
  const totDed    = filtered.reduce((s, r) => s + (r.totalDeductions || 0), 0);
  const totNet    = filtered.reduce((s, r) => s + (r.netSalary     || 0), 0);
  const totDays   = filtered.reduce((s, r) => s + (r.presentDays   || 0), 0);
  const totHours  = filtered.reduce((s, r) => s + (r.overtimeHours || 0), 0);

  // Period options (last 12 months)
  const periodOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 1300, margin: '0 auto', paddingBottom: '2rem' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: '1.2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="fi fi-rr-money-check-edit" style={{ color: '#166534' }} />
          Payroll Management
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0' }}>
          Process and manage labour wages, bonuses and payment status.
        </p>
      </div>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1.2rem' }}>
        {/* Name filter — Only for Owner/Office Manager */}
        {canCreate && (
          <select
            value={filterEmployee}
            onChange={e => setFilterEmployee(e.target.value)}
            style={selectStyle}
          >
            <option value="">All Employees</option>
            {employees.map(e => (
              <option key={e._id || e.id} value={e._id || e.id}>{e.name}</option>
            ))}
            {/* Also populate from records when employees not yet loaded */}
            {employees.length === 0 && Array.from(new Map(records.map(r => [r.employeeId, r])).values()).map(r => (
              <option key={r.employeeId} value={r.employeeId}>{r.employeeName}</option>
            ))}
          </select>
        )}

        {/* Period picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1.5px solid var(--border)', borderRadius: 8, padding: '0 10px', height: 38 }}>
          <i className="fi fi-rr-calendar" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }} />
          <select
            value={filterPeriod}
            onChange={e => setFilterPeriod(e.target.value)}
            style={{ border: 'none', outline: 'none', fontSize: '0.85rem', background: 'transparent', cursor: 'pointer', color: 'var(--text)' }}
          >
            {periodOptions.map(p => (
              <option key={p} value={p}>{periodLabel(p)}</option>
            ))}
          </select>
        </div>

        {/* Status filter */}
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle}>
          <option value="">All Status</option>
          {Object.entries(STATUS_META).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>

        <div style={{ flex: 1 }} />

        {/* Action buttons */}
        {canCreate && (
          <button
            className="btn btn-primary"
            onClick={openCreate}
            style={{ background: '#166534', border: 'none', borderRadius: 8, padding: '0 16px', height: 38, fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <i className="fi fi-rr-plus" /> New Payroll Entry
          </button>
        )}
        {canCreate && (
          <button
            onClick={handleBulk}
            disabled={saving}
            style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, padding: '0 14px', height: 38, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <i className="fi fi-rr-file-export" /> Export PDF
          </button>
        )}
        {canPay && records.filter(r => r.status === 'approved').length > 0 && (
          <button
            onClick={handleBulkPay}
            disabled={bulkPaying || saving}
            style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', color: '#fff', border: 'none', borderRadius: 8, padding: '0 14px', height: 38, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: bulkPaying ? 0.7 : 1 }}
          >
            <i className={`fi ${bulkPaying ? 'fi-rr-spinner' : 'fi-rr-paper-plane'}`} />
            {bulkPaying ? 'Processing…' : `Pay All (${records.filter(r => r.status === 'approved').length}) via Chapa`}
          </button>
        )}        <button
          onClick={() => exportToCSV(filtered, filterPeriod)}
          style={{ background: '#0891b2', color: '#fff', border: 'none', borderRadius: 8, padding: '0 14px', height: 38, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <i className="fi fi-rr-file-csv" /> CSV Template
        </button>
        <button
          onClick={() => exportToCSV(filtered, filterPeriod)}
          style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '0 14px', height: 38, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <i className="fi fi-rr-download" /> Generate CSV
        </button>
        <button onClick={load} style={{ background: '#f3f4f6', border: '1px solid var(--border)', borderRadius: 8, padding: '0 10px', height: 38, cursor: 'pointer', color: 'var(--text-muted)' }}>
          <i className="fi fi-rr-refresh" />
        </button>
      </div>

      {/* ── Alerts ── */}
      {error   && <div className="alert alert-error"   style={{ marginBottom: '0.8rem' }}><i className="fi fi-rr-triangle-warning" style={{ marginRight: 6 }} />{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: '0.8rem' }}><i className="fi fi-rr-check" style={{ marginRight: 6 }} />{success}</div>}

      {/* ── Pending approval banner — for owner ── */}
      {canApprove && records.filter(r => r.status === 'submitted').length > 0 && (
        <div style={{ background: '#fef9c3', border: '1px solid #fcd34d', borderRadius: 10, padding: '0.65rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.85rem', color: '#92400e' }}>
          <i className="fi fi-rr-alarm-clock" style={{ flexShrink: 0 }} />
          <strong>{records.filter(r => r.status === 'submitted').length} payroll record{records.filter(r => r.status === 'submitted').length > 1 ? 's' : ''} awaiting your approval.</strong>
          <button onClick={() => setFilterStatus('submitted')} style={{ marginLeft: 'auto', background: '#166634', color: '#fff', border: 'none', borderRadius: 6, padding: '3px 12px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>
            Review
          </button>
        </div>
      )}

      {/* ── Ready-to-pay banner — for office manager ── */}
      {canPay && records.filter(r => r.status === 'approved').length > 0 && (
        <div style={{ background: '#f5f3ff', border: '1px solid #c4b5fd', borderRadius: 10, padding: '0.65rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.85rem', color: '#5b21b6' }}>
          <i className="fi fi-rr-paper-plane" style={{ flexShrink: 0 }} />
          <strong>{records.filter(r => r.status === 'approved').length} payroll record{records.filter(r => r.status === 'approved').length > 1 ? 's' : ''} approved and ready to pay via Chapa.</strong>
          <button onClick={handleBulkPay} disabled={bulkPaying} style={{ marginLeft: 'auto', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 6, padding: '3px 14px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
            <i className={`fi ${bulkPaying ? 'fi-rr-spinner' : 'fi-rr-paper-plane'}`} />
            {bulkPaying ? 'Processing…' : 'Pay All via Chapa'}
          </button>
        </div>
      )}

      {/* ── Summary cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total Payroll',    value: formatETB(totalPayroll), bg: '#fff',    border: '#e5e7eb', textColor: '#166534',  sub: 'All records' },
          { label: 'Pending Payment',  value: formatETB(pendingPay),   bg: '#fffbeb', border: '#fcd34d', textColor: '#92400e',  sub: 'Draft / Submitted / Approved' },
          { label: 'Paid Out',         value: formatETB(paidOut),      bg: '#f0fdf4', border: '#86efac', textColor: '#166534',  sub: 'Fully paid' },
          { label: 'Workers',          value: workerCount,             bg: '#eff6ff', border: '#bfdbfe', textColor: '#1e40af',  sub: 'Active employees' },
        ].map(c => (
          <div key={c.label} style={{ background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: 12, padding: '1rem 1.2rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: c.textColor }}>{c.value}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <i className="fi fi-rr-spinner" style={{ fontSize: '2rem', display: 'block', marginBottom: 10 }} />Loading payroll…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: '#fff', borderRadius: 12, border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
          <i className="fi fi-rr-money-check-edit" style={{ fontSize: '2.5rem', display: 'block', marginBottom: 10, color: '#d1d5db' }} />
          <p>No payroll records for {periodLabel(filterPeriod)}.</p>
          {canCreate && (
            <button className="btn btn-primary" onClick={openCreate} style={{ marginTop: 8 }}>
              <i className="fi fi-rr-plus" style={{ marginRight: 6 }} />New Payroll Entry
            </button>
          )}
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '2px solid var(--border)' }}>
                  {['Worker','Period','Base','Bonus','Deductions','Net Pay','Days','Hours','Status','Actions'].map(h => (
                    <th key={h} style={{ padding: '0.65rem 0.9rem', textAlign: 'left', fontWeight: 700, color: '#6b7280', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const sm = STATUS_META[r.status] || STATUS_META.draft;
                  const emp = employees.find(e => String(e._id || e.id) === String(r.employeeId));
                  return (
                    <tr key={r._id || r.id} style={{ borderBottom: '1px solid #f3f4f6' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                      {/* Worker */}
                      <td style={{ padding: '0.7rem 0.9rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #166534, #15803d)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>
                            {(r.employeeName || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem', lineHeight: 1.3 }}>{r.employeeName}</div>
                            <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{emp?.email || (r.employeeRole || '').replace('_', ' ')}</div>
                          </div>
                        </div>
                      </td>
                      {/* Period */}
                      <td style={{ padding: '0.7rem 0.9rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>{r.payPeriod}</td>
                      {/* Base */}
                      <td style={{ padding: '0.7rem 0.9rem', fontWeight: 600 }}>{formatETB(r.baseSalary)}</td>
                      {/* Bonus */}
                      <td style={{ padding: '0.7rem 0.9rem', color: r.bonus > 0 ? '#16a34a' : 'var(--text-muted)' }}>
                        {r.bonus > 0 ? `+${formatETB(r.bonus)}` : '—'}
                      </td>
                      {/* Deductions */}
                      <td style={{ padding: '0.7rem 0.9rem', color: r.totalDeductions > 0 ? '#dc2626' : 'var(--text-muted)' }}>
                        {r.totalDeductions > 0 ? `-${formatETB(r.totalDeductions)}` : '—'}
                      </td>
                      {/* Net Pay */}
                      <td style={{ padding: '0.7rem 0.9rem', fontWeight: 800, color: '#166534', fontSize: '0.9rem' }}>{formatETB(r.netSalary)}</td>
                      {/* Days */}
                      <td style={{ padding: '0.7rem 0.9rem', color: 'var(--text-muted)' }}>{r.presentDays ?? 0}</td>
                      {/* Hours */}
                      <td style={{ padding: '0.7rem 0.9rem', color: 'var(--text-muted)' }}>{r.overtimeHours ?? 0}h</td>
                      {/* Status */}
                      <td style={{ padding: '0.7rem 0.9rem' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: sm.bg, color: sm.color, fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: sm.dot, display: 'inline-block', flexShrink: 0 }} />
                          {sm.label}
                        </span>
                      </td>
                      {/* Actions */}
                      <td style={{ padding: '0.7rem 0.9rem', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {/* View — always visible */}
                          <button onClick={() => setShowDetail(r)} title="View detail" style={iconBtn('#f3f4f6','#374151')}>
                            <i className="fi fi-rr-eye" />
                          </button>

                          {/* DRAFT: Edit + Submit */}
                          {r.status === 'draft' && canCreate && (
                            <button onClick={() => openEdit(r)} title="Edit" style={iconBtn('#fff7ed','#c2410c')}>
                              <i className="fi fi-rr-edit" />
                            </button>
                          )}
                          {r.status === 'draft' && canSubmit && (
                            <button onClick={() => act(payrollApi.submit, r._id || r.id)} title="Submit for approval" style={iconBtn('#dbeafe','#1e40af')}>
                              <i className="fi fi-rr-paper-plane" />
                            </button>
                          )}
                          {r.status === 'draft' && canDelete && (
                            <button onClick={() => handleDelete(r)} title="Delete" style={iconBtn('#fee2e2','#991b1b')}>
                              <i className="fi fi-rr-trash" />
                            </button>
                          )}

                          {/* SUBMITTED: Approve + Reject (owner only) */}
                          {r.status === 'submitted' && canApprove && (
                            <button onClick={() => act(payrollApi.approve, r._id || r.id)} title="Approve" style={iconBtn('#dcfce7','#166534')}>
                              <i className="fi fi-rr-check" />
                            </button>
                          )}
                          {r.status === 'submitted' && canApprove && (
                            <button onClick={() => { setRejectModal(r); setRejectReason(''); }} title="Reject" style={iconBtn('#fee2e2','#991b1b')}>
                              <i className="fi fi-rr-cross" />
                            </button>
                          )}

                          {/* APPROVED: Pay via Chapa (office manager only) */}
                          {r.status === 'approved' && canPay && (
                            <button
                              onClick={async () => {
                                setPayModal(r); setPayResult(null); setEmpInfo(null);
                                setEmpLoading(true);
                                try {
                                  const emp = await employeeApi.getOne(r.employeeId);
                                  setEmpInfo(emp);
                                } catch (_) { setEmpInfo({}); }
                                finally { setEmpLoading(false); }
                              }}
                              title={r.netSalary > 0 ? 'Pay salary via Chapa' : 'Net salary is ETB 0 — edit payroll first'}
                              style={{ ...iconBtn(r.netSalary > 0 ? '#f3e8ff' : '#f3f4f6', r.netSalary > 0 ? '#7c3aed' : '#9ca3af'), width: 'auto', padding: '0 8px', gap: 4, fontSize: '0.75rem', fontWeight: 700 }}>
                              <i className="fi fi-rr-paper-plane" />
                              {r.netSalary > 0 ? 'Chapa' : '⚠ ETB 0'}
                            </button>
                          )}

                          {/* REJECTED: Delete (owner only) */}
                          {r.status === 'rejected' && canDelete && (
                            <button onClick={() => handleDelete(r)} title="Delete" style={iconBtn('#fee2e2','#991b1b')}>
                              <i className="fi fi-rr-trash" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Totals row */}
              {filtered.length > 1 && (
                <tfoot>
                  <tr style={{ background: '#f9fafb', borderTop: '2px solid var(--border)', fontWeight: 700 }}>
                    <td style={{ padding: '0.6rem 0.9rem', color: 'var(--text-muted)', fontSize: '0.8rem' }} colSpan={2}>Totals</td>
                    <td style={{ padding: '0.6rem 0.9rem' }}>{formatETB(totBase)}</td>
                    <td style={{ padding: '0.6rem 0.9rem', color: '#16a34a' }}>+{formatETB(totBonus)}</td>
                    <td style={{ padding: '0.6rem 0.9rem', color: '#dc2626' }}>-{formatETB(totDed)}</td>
                    <td style={{ padding: '0.6rem 0.9rem', color: '#166534', fontSize: '0.9rem' }}>{formatETB(totNet)}</td>
                    <td style={{ padding: '0.6rem 0.9rem', color: 'var(--text-muted)' }}>{totDays} days</td>
                    <td style={{ padding: '0.6rem 0.9rem', color: 'var(--text-muted)' }}>{totHours.toFixed(1)}h</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ── New / Edit Payroll Modal ── */}
      {showForm && (
        <div style={overlayStyle}>
          <div style={modalStyle(600)}>
            <div style={modalHeader}>
              <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1.1rem' }}>
                <i className="fi fi-rr-money-check-edit" style={{ marginRight: 8, color: '#166534' }} />
                {editRecord ? 'Edit Payroll Record' : 'New Payroll Entry'}
              </h3>
              <button onClick={() => setShowForm(false)} style={closeBtn}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', padding: '1rem 1.5rem' }}>
              {/* Employee */}
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label>Employee *</label>
                <select
                  value={form.employeeId}
                  onChange={e => {
                    const emp = employees.find(em => (em._id || em.id) === e.target.value);
                    setForm(f => ({ ...f, employeeId: e.target.value, baseSalary: emp?.baseSalary ? String(emp.baseSalary) : f.baseSalary }));
                  }}
                  disabled={!!editRecord}
                >
                  <option value="">Select employee…</option>
                  {employees.map(e => (
                    <option key={e._id || e.id} value={e._id || e.id}>
                      {e.name} — {ROLE_LABEL[e.role] || e.role} {e.employeeId ? `(${e.employeeId})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Pay Period */}
              <div className="form-group">
                <label>Pay Period (YYYY-MM) *</label>
                <input
                  value={form.payPeriod}
                  onChange={e => setForm(f => ({ ...f, payPeriod: e.target.value }))}
                  placeholder="2026-08"
                  disabled={!!editRecord}
                />
              </div>

              {/* Basic Salary */}
              <div className="form-group">
                <label>Basic Salary (ETB) *</label>
                <input type="number" min="0" value={form.baseSalary}
                  onChange={e => setForm(f => ({ ...f, baseSalary: e.target.value }))} placeholder="0.00" />
              </div>

              {/* Overtime Pay */}
              <div className="form-group">
                <label>Overtime Pay (ETB)</label>
                <input type="number" min="0" value={form.overtimePay}
                  onChange={e => setForm(f => ({ ...f, overtimePay: e.target.value }))} placeholder="0" />
              </div>

              {/* Bonus */}
              <div className="form-group">
                <label>Bonus (ETB)</label>
                <input type="number" min="0" value={form.bonus}
                  onChange={e => setForm(f => ({ ...f, bonus: e.target.value }))} placeholder="0" />
              </div>

              {/* Allowance */}
              <div className="form-group">
                <label>Allowance (ETB)</label>
                <input type="number" min="0" value={form.allowance}
                  onChange={e => setForm(f => ({ ...f, allowance: e.target.value }))} placeholder="0" />
              </div>

              {/* Other Earnings */}
              <div className="form-group">
                <label>Other Earnings (ETB)</label>
                <input type="number" min="0" value={form.otherEarnings}
                  onChange={e => setForm(f => ({ ...f, otherEarnings: e.target.value }))} placeholder="0" />
              </div>

              {/* Unpaid */}
              <div className="form-group">
                <label>Unpaid Days Deduction (ETB)</label>
                <input type="number" min="0" value={form.unpaidDays}
                  onChange={e => setForm(f => ({ ...f, unpaidDays: e.target.value }))} placeholder="0" />
              </div>

              {/* Other Deductions */}
              <div className="form-group">
                <label>Other Deductions (ETB)</label>
                <input type="number" min="0" value={form.otherDeductions}
                  onChange={e => setForm(f => ({ ...f, otherDeductions: e.target.value }))} placeholder="0" />
              </div>

              {/* Notes */}
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label>Notes</label>
                <textarea rows={2} value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 7, border: '1px solid var(--border)', resize: 'vertical', fontSize: '0.87rem' }} />
              </div>
            </div>

            {/* Live preview */}
            {parseFloat(form.baseSalary) > 0 && (
              <div style={{ margin: '0 1.5rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '0.75rem 1rem', fontSize: '0.84rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, textAlign: 'center' }}>
                  {[
                    { label: 'Gross',    value: formatETB(fv.gross)   },
                    { label: 'Tax',      value: formatETB(fv.tax)     },
                    { label: 'Pension',  value: formatETB(fv.pension) },
                    { label: 'Net Pay',  value: formatETB(fv.net), highlight: true },
                  ].map(s => (
                    <div key={s.label}>
                      <div style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: 2 }}>{s.label}</div>
                      <div style={{ fontWeight: s.highlight ? 800 : 600, color: s.highlight ? '#166534' : 'var(--text)', fontSize: s.highlight ? '1rem' : '0.88rem' }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', padding: '1rem 1.5rem' }}>
              <button className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ background: '#166534', border: 'none' }}>
                {saving ? <i className="fi fi-rr-spinner" /> : editRecord ? 'Save Changes' : 'Create Record'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail / Payslip Modal ── */}
      {showDetail && (
        <div style={overlayStyle}>
          <div style={modalStyle(540)}>
            <div style={modalHeader}>
              <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1.05rem' }}>
                <i className="fi fi-rr-money-check-edit" style={{ marginRight: 8, color: '#0891b2' }} />
                Payslip — {showDetail.employeeName}
              </h3>
              <button onClick={() => setShowDetail(null)} style={closeBtn}>✕</button>
            </div>
            <div style={{ padding: '1rem 1.5rem', overflowY: 'auto', maxHeight: '70vh' }}>
              {/* Meta */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginBottom: '1rem', fontSize: '0.84rem' }}>
                {[
                  ['Period', showDetail.payPeriod],
                  ['Role',   (showDetail.employeeRole || '—').replace('_',' ')],
                  ['Dept',   showDetail.department || '—'],
                  ['Status', showDetail.status],
                ].map(([k, v]) => (
                  <div key={k} style={{ background: '#f9fafb', borderRadius: 7, padding: '0.4rem 0.7rem' }}>
                    <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginBottom: 2 }}>{k}</div>
                    <div style={{ fontWeight: 600 }}>{v}</div>
                  </div>
                ))}
              </div>
              {/* Earnings */}
              <div style={{ marginBottom: '0.8rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#6b7280', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Earnings</div>
                {[['Basic Salary', showDetail.baseSalary], ['Overtime Pay', showDetail.overtimePay], ['Bonus', showDetail.bonus], ['Allowance', showDetail.allowance], ['Other Earnings', showDetail.otherEarnings]]
                  .filter(([, v]) => (v || 0) > 0)
                  .map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', fontSize: '0.84rem', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ color: '#6b7280' }}>{k}</span><span>{formatETB(v)}</span>
                    </div>
                  ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', fontWeight: 700 }}>
                  <span>Gross Salary</span><span style={{ color: '#166534' }}>{formatETB(showDetail.grossSalary)}</span>
                </div>
              </div>
              {/* Deductions */}
              <div style={{ marginBottom: '0.8rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#6b7280', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Deductions</div>
                {[['Income Tax', showDetail.incomeTax], ['Pension (7%)', showDetail.pensionEmployee], ['Unpaid Days', showDetail.unpaidDays], ['Other Deductions', showDetail.otherDeductions]]
                  .filter(([, v]) => (v || 0) > 0)
                  .map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', fontSize: '0.84rem', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ color: '#6b7280' }}>{k}</span><span style={{ color: '#dc2626' }}>{formatETB(v)}</span>
                    </div>
                  ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', fontWeight: 700 }}>
                  <span>Total Deductions</span><span style={{ color: '#dc2626' }}>{formatETB(showDetail.totalDeductions)}</span>
                </div>
              </div>
              {/* Net */}
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '0.8rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 800, fontSize: '1rem' }}>NET SALARY</span>
                <span style={{ fontWeight: 800, fontSize: '1.3rem', color: '#166534' }}>{formatETB(showDetail.netSalary)}</span>
              </div>
              {/* Attendance details */}
              {(showDetail.presentDays > 0 || showDetail.workingDays > 0) && (
                <div style={{ marginTop: '0.8rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.78rem', color: '#6b7280' }}>
                  {[
                    ['Working Days', showDetail.workingDays],
                    ['Present',      showDetail.presentDays],
                    ['Absent',       showDetail.absentDays],
                    ['Overtime hrs', showDetail.overtimeHours],
                  ].map(([k, v]) => (
                    <span key={k} style={{ background: '#f9fafb', borderRadius: 20, padding: '3px 10px', border: '1px solid #e5e7eb' }}>
                      {k}: <strong>{v ?? 0}</strong>
                    </span>
                  ))}
                </div>
              )}
              {showDetail.notes && (
                <p style={{ marginTop: '0.6rem', fontSize: '0.82rem', color: '#6b7280' }}><strong>Notes:</strong> {showDetail.notes}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Chapa Pay Confirmation Modal ── */}
      {payModal && (
        <div style={overlayStyle}>
          <div style={modalStyle(480)}>
            <div style={modalHeader}>
              <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', borderRadius: 8, padding: '4px 8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fi fi-rr-paper-plane" style={{ color: '#fff', fontSize: '0.9rem' }} />
                </span>
                Pay Salary via Chapa
              </h3>
              <button onClick={() => { setPayModal(null); setPayResult(null); }} style={closeBtn}>✕</button>
            </div>

            <div style={{ padding: '1.2rem 1.5rem' }}>
              {!payResult ? (
                <>
                  {/* Payment summary */}
                  <div style={{ background: 'linear-gradient(135deg,#f5f3ff,#ede9fe)', border: '1.5px solid #c4b5fd', borderRadius: 12, padding: '1rem 1.2rem', marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.72rem', color: '#7c3aed', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Transfer Details</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.84rem' }}>
                      {[
                        ['Employee',   payModal.employeeName],
                        ['Period',     payModal.payPeriod],
                        ['Department', payModal.department || '—'],
                        ['Status',     payModal.status],
                      ].map(([k, v]) => (
                        <div key={k} style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 7, padding: '0.4rem 0.6rem' }}>
                          <div style={{ fontSize: '0.68rem', color: '#9ca3af' }}>{k}</div>
                          <div style={{ fontWeight: 600 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: '0.75rem', background: 'rgba(255,255,255,0.8)', borderRadius: 8, padding: '0.6rem 0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: '#374151' }}>Net Salary to Transfer</span>
                      <span style={{ fontWeight: 800, fontSize: '1.25rem', color: payModal.netSalary > 0 ? '#7c3aed' : '#ef4444' }}>
                        {formatETB(payModal.netSalary)}
                      </span>
                    </div>
                  </div>

                  {/* Zero salary warning — must fix before paying */}
                  {payModal.netSalary <= 0 && (
                    <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, padding: '0.9rem 1rem', marginBottom: '1rem' }}>
                      <div style={{ fontWeight: 700, color: '#991b1b', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 7 }}>
                        <i className="fi fi-rr-triangle-warning" /> Net Salary is ETB 0.00
                      </div>
                      <p style={{ fontSize: '0.82rem', color: '#7f1d1d', margin: 0 }}>
                        This payroll record has no salary calculated. To fix:
                      </p>
                      <ol style={{ fontSize: '0.8rem', color: '#7f1d1d', margin: '6px 0 0', paddingLeft: 18, lineHeight: 1.7 }}>
                        <li>Go to <strong>Employee Management</strong> → Edit {payModal.employeeName} → set <strong>Basic Salary</strong></li>
                        <li>Come back to <strong>Payroll</strong> → click ✏️ Edit on this record → Save to recalculate</li>
                        <li>Re-submit and re-approve the payroll</li>
                      </ol>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.8rem' }}>
                        <button className="btn btn-outline" onClick={() => { setPayModal(null); setPayResult(null); }}>Close</button>
                      </div>
                    </div>
                  )}

                  {/* Chapa readiness check — only show when netSalary > 0 */}
                  {payModal.netSalary > 0 && empLoading && (
                    <div style={{ textAlign: 'center', padding: '0.8rem', fontSize: '0.83rem', color: '#6b7280' }}>
                      <i className="fi fi-rr-spinner" style={{ marginRight: 6 }} />Checking payment info…
                    </div>
                  )}
                  {payModal.netSalary > 0 && !empLoading && (() => {
                    const accountNumber = empInfo?.bankAccount || empInfo?.accountNumber || '';
                    const bankName      = empInfo?.bankName;

                    return (
                      <>
                        {/* Payment info row */}
                        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#166534' }}>
                              <i className="fi fi-rr-check-circle" style={{ marginRight: 6 }} />
                              Ready to pay via Chapa
                            </span>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', fontSize: '0.79rem' }}>
                            <div style={{ background: 'rgba(255,255,255,0.8)', borderRadius: 6, padding: '0.35rem 0.5rem' }}>
                              <div style={{ fontSize: '0.65rem', color: '#9ca3af' }}>Bank</div>
                              <div style={{ fontWeight: 600, color: bankName ? '#111827' : '#6b7280' }}>{bankName || '—'}</div>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.8)', borderRadius: 6, padding: '0.35rem 0.5rem' }}>
                              <div style={{ fontSize: '0.65rem', color: '#9ca3af' }}>Account No</div>
                              <div style={{ fontWeight: 600, fontFamily: 'monospace', color: accountNumber ? '#111827' : '#6b7280' }}>
                                {accountNumber ? '••••' + String(accountNumber).slice(-4) : '—'}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Warning / polling state */}
                        {paying ? (
                          <div style={{ background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 8, padding: '0.75rem 0.9rem', marginBottom: '1rem', fontSize: '0.83rem', color: '#1e40af', display: 'flex', gap: 10, alignItems: 'center' }}>
                            <i className="fi fi-rr-spinner" style={{ flexShrink: 0, fontSize: '1.1rem' }} />
                            <span>
                              <strong>Chapa payment page opened in a new tab.</strong><br />
                              Complete the payment there — this page will update automatically when done.
                            </span>
                          </div>
                        ) : (
                          <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '0.65rem 0.9rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#92400e', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                            <i className="fi fi-rr-triangle-warning" style={{ flexShrink: 0, marginTop: 1 }} />
                            <span>This will open <strong>Chapa payment</strong> in a new tab for <strong>{formatETB(payModal.netSalary)}</strong> to {payModal.employeeName}.</span>
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button className="btn btn-outline" onClick={() => { setPayModal(null); setPayResult(null); setPaying(false); }}>
                            {paying ? 'Close' : 'Cancel'}
                          </button>
                          <button
                            onClick={handlePayWithChapa}
                            disabled={paying}
                            style={{ background: paying ? '#6d28d9' : 'linear-gradient(135deg,#7c3aed,#6d28d9)', color: '#fff', border: 'none', borderRadius: 8, padding: '0.55rem 1.4rem', fontWeight: 700, cursor: paying ? 'not-allowed' : 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 7, opacity: paying ? 0.7 : 1 }}>
                            {paying
                              ? <><i className="fi fi-rr-spinner" /> Waiting for payment…</>
                              : <><i className="fi fi-rr-paper-plane" /> Pay via Chapa →</>
                            }
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </>
              ) : payResult.success ? (
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: payResult.simulated ? '#fef3c7' : '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                    <i className={`fi ${payResult.simulated ? 'fi-rr-test-tube' : 'fi-rr-check-circle'}`} style={{ fontSize: '2rem', color: payResult.simulated ? '#92400e' : '#166534' }} />
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', color: payResult.simulated ? '#92400e' : '#166534', marginBottom: 6 }}>
                    {payResult.simulated ? 'Simulated Payment' : 'Payment Successful!'}
                  </div>
                  {payResult.simulated && (
                    <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '0.6rem 0.9rem', marginBottom: '0.8rem', fontSize: '0.78rem', color: '#92400e', textAlign: 'left' }}>
                      <i className="fi fi-rr-info" style={{ marginRight: 6 }} />
                      <strong>Development mode:</strong> No real money was transferred. Set <code style={{ background: '#fef3c7', padding: '1px 5px', borderRadius: 4 }}>CHAPA_SECRET_KEY</code> in <code style={{ background: '#fef3c7', padding: '1px 5px', borderRadius: 4 }}>backend/.env</code> for live transfers.
                    </div>
                  )}
                  <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1rem' }}>{payResult.message}</div>
                  <div style={{ background: payResult.simulated ? '#fffbeb' : '#f0fdf4', border: `1px solid ${payResult.simulated ? '#fcd34d' : '#86efac'}`, borderRadius: 10, padding: '0.8rem 1rem', textAlign: 'left', fontSize: '0.82rem', marginBottom: '1.2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: '#6b7280' }}>Amount</span>
                      <span style={{ fontWeight: 700, color: '#166534' }}>{formatETB(payResult.netSalary)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: '#6b7280' }}>Reference</span>
                      <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.75rem' }}>{payResult.chapaRef || payResult.txRef}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#6b7280' }}>TX Ref</span>
                      <span style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.75rem' }}>{payResult.txRef}</span>
                    </div>
                  </div>
                  <button className="btn btn-primary" onClick={() => { setPayModal(null); setPayResult(null); }} style={{ background: '#166534', border: 'none' }}>
                    <i className="fi fi-rr-check" style={{ marginRight: 6 }} />Done
                  </button>
                </div>
              ) : (
                /* ── Error state ── */
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                    <i className="fi fi-rr-cross-circle" style={{ fontSize: '2rem', color: '#991b1b' }} />
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: '#991b1b', marginBottom: 8 }}>Payment Failed</div>
                  <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '0.7rem 1rem', fontSize: '0.83rem', color: '#7f1d1d', marginBottom: '1.2rem', textAlign: 'left' }}>
                    <i className="fi fi-rr-triangle-warning" style={{ marginRight: 6 }} />{payResult.message}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                    <button className="btn btn-outline" onClick={() => { setPayModal(null); setPayResult(null); }}>Close</button>
                    <button className="btn btn-primary" onClick={() => setPayResult(null)} style={{ background: '#7c3aed', border: 'none' }}>
                      <i className="fi fi-rr-refresh" style={{ marginRight: 6 }} />Try Again
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Reject Modal ── */}
      {rejectModal && (
        <div style={overlayStyle}>
          <div style={modalStyle(400)}>
            <div style={modalHeader}>
              <h3 style={{ margin: 0, fontWeight: 700, color: '#991b1b' }}>
                <i className="fi fi-rr-cross-circle" style={{ marginRight: 8 }} />Reject Payroll
              </h3>
              <button onClick={() => setRejectModal(null)} style={closeBtn}>✕</button>
            </div>
            <div style={{ padding: '1rem 1.5rem' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                Rejecting payroll for <strong>{rejectModal.employeeName}</strong> ({rejectModal.payPeriod}).
              </p>
              <div className="form-group">
                <label>Rejection Reason *</label>
                <textarea rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                  placeholder="Explain why this payroll is being rejected…"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 7, border: '1px solid var(--border)', resize: 'vertical', fontSize: '0.87rem' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', padding: '0 1.5rem 1.2rem' }}>
              <button className="btn btn-outline" onClick={() => setRejectModal(null)}>Cancel</button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim() || saving}
                style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, padding: '0.5rem 1.2rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem' }}
              >
                {saving ? 'Rejecting…' : 'Reject Payroll'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Style helpers ──────────────────────────────────────────────────────────────
const selectStyle = {
  padding: '0 12px',
  height: 38,
  borderRadius: 8,
  border: '1.5px solid var(--border)',
  fontSize: '0.85rem',
  background: '#fff',
  color: 'var(--text)',
  cursor: 'pointer',
};

const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  zIndex: 1000, display: 'flex', alignItems: 'flex-start',
  justifyContent: 'center', overflowY: 'auto', padding: '2rem 1rem',
};

const modalStyle = (maxW) => ({
  background: '#fff', borderRadius: 14, width: '100%',
  maxWidth: maxW, boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
  display: 'flex', flexDirection: 'column',
});

const modalHeader = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)',
};

const closeBtn = {
  background: 'none', border: 'none', fontSize: '1.1rem',
  cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1,
};

const iconBtn = (bg, color) => ({
  background: bg, color, border: 'none', borderRadius: 7,
  width: 30, height: 30, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: '0.85rem', flexShrink: 0,
});
