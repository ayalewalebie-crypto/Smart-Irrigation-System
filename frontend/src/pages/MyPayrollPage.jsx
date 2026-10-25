import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { payrollApi, employeeApi, formatETB } from '../services/api';

const STATUS_STYLE = {
  draft:     { labelKey: 'draft',     bg: '#f3f4f6', color: '#6b7280', border: '#d1d5db' },
  submitted: { labelKey: 'submitted', bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  approved:  { labelKey: 'approved',  bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
  paid:      { labelKey: 'paid',      bg: '#dcfce7', color: '#166534', border: '#86efac' },
  rejected:  { labelKey: 'rejected',  bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
};

const EMP_TYPE_LABEL = {
  permanent: 'permanent', contract: 'contract',
  part_time: 'partTime',  seasonal: 'seasonal',
};

const ROLE_COLOR = {
  admin: '#ef4444', office_manager: '#0891b2', labor: '#2563eb',
};

function InfoCard({ icon, label, value, color }) {
  return (
    <div style={{
      background: '#f9fafb', borderRadius: 10, padding: '0.75rem 1rem',
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      border: '1px solid #e5e7eb',
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: (color || '#166534') + '18',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <i className={`fi ${icon}`} style={{ color: color || '#166534', fontSize: '1rem' }} />
      </div>
      <div>
        <div style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
        <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#111827', marginTop: 1 }}>{value || '—'}</div>
      </div>
    </div>
  );
}

function SalaryRow({ label, value, bold, color, indent }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '0.42rem 0', borderBottom: '1px solid #f3f4f6', fontSize: '0.85rem',
      paddingLeft: indent ? '1rem' : 0,
    }}>
      <span style={{ color: indent ? '#6b7280' : '#374151' }}>{label}</span>
      <span style={{ fontWeight: bold ? 700 : 400, color: color || '#111827' }}>{value ?? '—'}</span>
    </div>
  );
}

export default function MyPayrollPage() {
  const { user } = useAuth();
  const { t }    = useLang();

  const MONTH_NAMES = [
    t('january'),t('february'),t('march'),t('april'),
    t('may'),t('june'),t('july'),t('august'),
    t('september'),t('october'),t('november'),t('december'),
  ];
  const [profile,  setProfile]  = useState(null);
  const [records,  setRecords]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [selected, setSelected] = useState(null);
  const [viewYear, setViewYear] = useState(new Date().getFullYear());

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [empResult, payrollResult] = await Promise.allSettled([
        employeeApi.getMe(),
        payrollApi.getMy(),
      ]);

      if (empResult.status === 'fulfilled') setProfile(empResult.value);

      if (payrollResult.status === 'fulfilled' && Array.isArray(payrollResult.value)) {
        const list = payrollResult.value;
        setRecords(list);
        if (list.length > 0) setSelected(list[0]);
      } else {
        setRecords([]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Group records by year
  const years = [...new Set(records.map(r => r.year))].sort((a, b) => b - a);
  if (years.length > 0 && !years.includes(viewYear)) setViewYear(years[0]);

  // Records for the selected year, indexed by month (1–12)
  const byMonth = {};
  records.filter(r => r.year === viewYear).forEach(r => { byMonth[r.month] = r; });

  // Totals for selected year
  const yearRecords = records.filter(r => r.year === viewYear);
  const yearGross   = yearRecords.reduce((s, r) => s + (r.grossSalary   || 0), 0);
  const yearNet     = yearRecords.reduce((s, r) => s + (r.netSalary     || 0), 0);
  const yearTax     = yearRecords.reduce((s, r) => s + (r.incomeTax     || 0), 0);
  const yearPaid    = yearRecords.filter(r => r.status === 'paid').reduce((s, r) => s + (r.netSalary || 0), 0);

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
      <i className="fi fi-rr-spinner" style={{ fontSize: '2rem', display: 'block', marginBottom: 10 }} />
      Loading payroll information...
    </div>
  );

  if (error) return (
    <div className="alert alert-error" style={{ margin: '1rem' }}>
      <i className="fi fi-rr-triangle-warning" style={{ marginRight: 6 }} />{error}
    </div>
  );

  return (
    <div style={{ maxWidth: 1050, margin: '0 auto', paddingBottom: '2rem' }}>

      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="page-header">
        <h1>
          <i className="fi fi-rr-money-check-edit" style={{ marginRight: 8, color: '#166634' }} />
          {t('myPayroll')}
        </h1>
        <button className="btn btn-outline btn-sm" onClick={load} title="Refresh">
          <i className="fi fi-rr-refresh" />
        </button>
      </div>

      {/* ── Employee HR Profile Card ─────────────────────────────────── */}
      {profile ? (
        <div className="card" style={{ marginBottom: '1.25rem', padding: 0, overflow: 'hidden' }}>
          <div style={{
            background: 'linear-gradient(135deg, #166534, #15803d)',
            padding: '1.2rem 1.5rem',
            display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
          }}>
            <div style={{
              width: 50, height: 50, borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <i className="fi fi-rr-user" style={{ color: '#fff', fontSize: '1.3rem' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em' }}>{t('employeeId').toUpperCase()}</div>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: '1.05rem' }}>{profile.name}</div>
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.8rem' }}>{profile.email}</div>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 700, fontSize: '0.73rem', padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.3)' }}>
                {profile.employeeId || 'No ID'}
              </span>
              <span style={{ background: (ROLE_COLOR[profile.role] || '#6b7280') + '44', color: '#fff', fontWeight: 700, fontSize: '0.73rem', padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.3)' }}>
                {profile.role === 'office_manager' ? 'Office Manager' : profile.role === 'labor' ? 'Laborer' : 'Admin'}
              </span>
              <span style={{ background: profile.isActive ? '#dcfce7' : '#fee2e2', color: profile.isActive ? '#166534' : '#991b1b', fontWeight: 700, fontSize: '0.73rem', padding: '3px 10px', borderRadius: 20 }}>
                {profile.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          <div style={{ padding: '1rem 1.5rem' }}>
            {/* Base salary highlight */}
            <div style={{
              background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
              border: '1.5px solid #86efac', borderRadius: 10,
              padding: '0.9rem 1.2rem', marginBottom: '0.9rem',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem',
            }}>
              <div>
                <div style={{ fontSize: '0.68rem', color: '#166534', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Monthly Base Salary</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#14532d', lineHeight: 1.1 }}>
                  {profile.baseSalary ? formatETB(profile.baseSalary) : 'Not Set'}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#16a34a', marginTop: 2 }}>Ethiopian Birr (ETB) · per month</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.68rem', color: '#6b7280', fontWeight: 600 }}>{t('employmentType')}</div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111827' }}>
                  {t(EMP_TYPE_LABEL[profile.employmentType]) || profile.employmentType || '—'}
                </div>
              </div>
            </div>

            {/* Info cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '0.6rem' }}>
              <InfoCard icon="fi-rr-briefcase"   label={t('department')}   value={profile.department}   color="#0891b2" />
              <InfoCard icon="fi-rr-id-badge"     label={t('jobTitle')}     value={profile.jobTitle}     color="#7c3aed" />
              <InfoCard icon="fi-rr-phone-call"   label={t('phone')}        value={profile.phone}        color="#059669" />
              {profile.assignedFarm && (
                <InfoCard icon="fi-rr-seedling"   label="Assigned Farm" value={profile.assignedFarm} color="#d97706" />
              )}
              {profile.startDate && (
                <InfoCard icon="fi-rr-calendar"   label="Start Date"
                  value={new Date(profile.startDate).toLocaleDateString('en-ET', { year:'numeric', month:'short', day:'numeric' })}
                  color="#166534" />
              )}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '0.8rem 1rem', marginBottom: '1.25rem', fontSize: '0.84rem', color: '#92400e', display: 'flex', gap: 8, alignItems: 'center' }}>
          <i className="fi fi-rr-info" />
          HR {t('profileTitle').toLowerCase()} — {t('lang')==='am' ? 'የቢሮ ሥራ አስኪያጅ ያነጋግሩ' : 'Contact your Office Manager or Owner to complete your employee information.'}
        </div>
      )}

      {/* ── Payroll Section ──────────────────────────────────────────── */}
      {records.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <i className="fi fi-rr-money-check-edit" style={{ fontSize: '3rem', display: 'block', marginBottom: 10, color: '#d1d5db' }} />
          <p style={{ color: 'var(--text-muted)', margin: 0, fontWeight: 600 }}>{t('noPayrollYet')}</p>
          <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: 6 }}>{t('payslipsAppear')}</p>
        </div>
      ) : (
        <>
          {/* ── Year selector + annual summary ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '0.3rem' }}>
              {years.map(y => (
                <button key={y}
                  onClick={() => { setViewYear(y); setSelected(null); }}
                  className={`btn btn-sm ${viewYear === y ? 'btn-primary' : 'btn-outline'}`}>
                  {y}
                </button>
              ))}
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {[
                { label: 'Gross',    value: formatETB(yearGross), color: '#1e40af' },
                { label: 'Tax',      value: formatETB(yearTax),   color: '#991b1b' },
                { label: 'Net',      value: formatETB(yearNet),   color: '#166534' },
                { label: 'Paid Out', value: formatETB(yearPaid),  color: '#059669' },
              ].map(s => (
                <div key={s.label} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '0.35rem 0.8rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.65rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>{s.label} {viewYear}</div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Monthly payment calendar grid ── */}
          <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem 1.2rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.8rem', color: '#374151' }}>
              <i className="fi fi-rr-calendar" style={{ marginRight: 6, color: '#166534' }} />
              Monthly Payroll — {viewYear}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.5rem' }}>
              {MONTH_NAMES.map((name, idx) => {
                const month = idx + 1;
                const rec   = byMonth[month];
                const st    = rec ? (STATUS_STYLE[rec.status] || STATUS_STYLE.draft) : null;
                const isSelected = selected && rec && (selected._id === rec._id);
                return (
                  <div key={month}
                    onClick={() => rec && setSelected(rec)}
                    style={{
                      borderRadius: 10, padding: '0.65rem 0.8rem',
                      border: isSelected
                        ? '2px solid #166534'
                        : rec ? `1.5px solid ${st.border}` : '1.5px dashed #e5e7eb',
                      background: isSelected ? '#f0fdf4' : rec ? st.bg + '80' : '#fafafa',
                      cursor: rec ? 'pointer' : 'default',
                      transition: 'all 0.15s',
                      position: 'relative',
                    }}
                  >
                    <div style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 600 }}>{name.slice(0, 3).toUpperCase()}</div>
                    {rec ? (
                      <>
                        <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#111827', marginTop: 2 }}>
                          {formatETB(rec.netSalary)}
                        </div>
                        <span style={{
                          display: 'inline-block', marginTop: 4,
                          background: st.bg, color: st.color,
                          border: `1px solid ${st.border}`,
                          fontSize: '0.62rem', fontWeight: 700,
                          padding: '1px 7px', borderRadius: 20,
                        }}>
                          {t(st.labelKey)}
                        </span>
                        {rec.status === 'paid' && (
                          <i className="fi fi-rr-check-circle" style={{ position: 'absolute', top: 6, right: 8, color: '#166534', fontSize: '0.75rem' }} />
                        )}
                      </>
                    ) : (
                      <div style={{ fontSize: '0.75rem', color: '#d1d5db', marginTop: 4 }}>—</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Payslip detail ── */}
          {selected && (() => {
            const st = STATUS_STYLE[selected.status] || STATUS_STYLE.draft;
            return (
              <div>
                {/* Payslip header */}
                <div style={{
                  background: 'linear-gradient(135deg, #1e3a5f, #1e40af)',
                  color: '#fff', borderRadius: 14, padding: '1.3rem 1.5rem', marginBottom: '1rem',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', opacity: 0.65, marginBottom: 2 }}>Smart Irrigation & Farm Management</div>
                      <h2 style={{ margin: '0 0 3px', fontSize: '1.15rem' }}>
                        <i className="fi fi-rr-document" style={{ marginRight: 7 }} />
                        Payslip — {MONTH_NAMES[(selected.month || 1) - 1]} {selected.year}
                      </h2>
                    </div>
                    <span style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}`, fontWeight: 700, fontSize: '0.8rem', padding: '4px 14px', borderRadius: 20 }}>
                      {t(st.labelKey)}
                    </span>
                  </div>
                  <div style={{ marginTop: '0.9rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: '0.65rem', opacity: 0.6 }}>{t('name')}</div>
                      <div style={{ fontWeight: 700 }}>{selected.employeeName || user?.name || '—'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.65rem', opacity: 0.6 }}>{t('department')}</div>
                      <div style={{ fontWeight: 700 }}>{selected.department || '—'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.65rem', opacity: 0.6 }}>{t('payPeriodLabel')}</div>
                      <div style={{ fontWeight: 700 }}>{selected.payPeriod}</div>
                    </div>
                    {selected.paymentDate && (
                      <div>
                        <div style={{ fontSize: '0.65rem', opacity: 0.6 }}>{t('paymentDate')}</div>
                        <div style={{ fontWeight: 700 }}>{new Date(selected.paymentDate).toLocaleDateString()}</div>
                      </div>
                    )}
                    {selected.paidAt && (
                      <div>
                        <div style={{ fontSize: '0.65rem', opacity: 0.6 }}>{t('paidOn')}</div>
                        <div style={{ fontWeight: 700, color: '#86efac' }}>{new Date(selected.paidAt).toLocaleDateString()}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Attendance summary */}
                {(selected.workingDays > 0 || selected.presentDays > 0) && (
                  <div className="card" style={{ marginBottom: '1rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.7rem', color: '#374151' }}>
                      <i className="fi fi-rr-calendar-check" style={{ marginRight: 6, color: '#166534' }} />Attendance Summary
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                      {[
                        { label: t('workingDays'), value: selected.workingDays ?? '—', color: '#374151' },
                        { label: t('present'),     value: selected.presentDays  ?? '—', color: '#166534' },
                        { label: t('absent'),      value: selected.absentDays   ?? '—', color: '#991b1b' },
                        { label: 'Leave',        value: selected.leaveDays    ?? '—', color: '#92400e' },
                      ].map(item => (
                        <div key={item.label} style={{ textAlign: 'center', background: '#f9fafb', borderRadius: 8, padding: '0.6rem' }}>
                          <div style={{ fontWeight: 800, fontSize: '1.3rem', color: item.color }}>{item.value}</div>
                          <div style={{ fontSize: '0.68rem', color: '#9ca3af', marginTop: 2 }}>{item.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Earnings & Deductions side by side */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  {/* Earnings */}
                  <div className="card">
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.6rem', color: '#166534' }}>
                      <i className="fi fi-rr-arrow-trend-up" style={{ marginRight: 6 }} />{t('earnings')}
                    </div>
                    <SalaryRow label={t('baseSalary')}       value={formatETB(selected.baseSalary)}    bold />
                    <SalaryRow label={t('overtimePay')}      value={formatETB(selected.overtimePay)}   indent />
                    <SalaryRow label={t('allowance')}        value={formatETB(selected.allowance)}     indent />
                    <SalaryRow label={t('bonus')}            value={formatETB(selected.bonus)}         indent />
                    <SalaryRow label={t('otherDeductions')}  value={formatETB(selected.otherEarnings)} indent />
                    <div style={{ borderTop: '2px solid #166534', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{t('grossSalary')}</span>
                      <span style={{ fontWeight: 800, color: '#166534' }}>{formatETB(selected.grossSalary)}</span>
                    </div>
                  </div>

                  {/* Deductions */}
                  <div className="card">
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.6rem', color: '#991b1b' }}>
                      <i className="fi fi-rr-arrow-trend-down" style={{ marginRight: 6 }} />{t('deductions')}
                    </div>
                    <SalaryRow label={t('incomeTax')}          value={formatETB(selected.incomeTax)}       indent />
                    <SalaryRow label={t('pension')}            value={formatETB(selected.pensionEmployee)} indent />
                    <SalaryRow label={t('unpaidDaysDeduction')}value={formatETB(selected.unpaidDays)}      indent />
                    <SalaryRow label={t('otherDeductions')}    value={formatETB(selected.otherDeductions)} indent />
                    <div style={{ borderTop: '2px solid #991b1b', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{t('totalDeductions')}</span>
                      <span style={{ fontWeight: 800, color: '#991b1b' }}>{formatETB(selected.totalDeductions)}</span>
                    </div>
                  </div>
                </div>

                {/* Net Salary — big result card */}
                <div style={{
                  background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
                  border: '2px solid #86efac', borderRadius: 12,
                  padding: '1.1rem 1.5rem', marginBottom: '1rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem',
                }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: '#166534', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('netSalary')} — {t('takeHome')}</div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#14532d', lineHeight: 1.1 }}>{formatETB(selected.netSalary)}</div>
                    <div style={{ fontSize: '0.72rem', color: '#16a34a', marginTop: 2 }}>
                      {MONTH_NAMES[(selected.month || 1) - 1]} {selected.year}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 600 }}>Payment Status</div>
                    <span style={{
                      display: 'inline-block', marginTop: 4,
                      background: st.bg, color: st.color,
                      border: `1.5px solid ${st.border}`,
                      fontWeight: 800, fontSize: '0.85rem',
                      padding: '4px 16px', borderRadius: 20,
                    }}>
                      {selected.status === 'paid'
                        ? <><i className="fi fi-rr-check-circle" style={{ marginRight: 5 }} />{t('paid').toUpperCase()}</>
                        : t(st.labelKey)}
                    </span>
                    {selected.paidAt && (
                      <div style={{ fontSize: '0.72rem', color: '#166534', marginTop: 4 }}>
                        {t('paidOn')} {new Date(selected.paidAt).toLocaleDateString('en-ET', { year:'numeric', month:'short', day:'numeric' })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Employer pension info */}
                {selected.pensionEmployer > 0 && (
                  <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '0.6rem 1rem', marginBottom: '1rem', fontSize: '0.82rem', color: '#0369a1', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <i className="fi fi-rr-info" />
                    Employer pension contribution (11%): <strong>{formatETB(selected.pensionEmployer)}</strong> — paid by employer on your behalf.
                  </div>
                )}

                {/* Notes */}
                {selected.notes && (
                  <div className="card">
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                      <i className="fi fi-rr-note" style={{ marginRight: 6 }} />Notes
                    </div>
                    <p style={{ fontSize: '0.85rem', color: '#374151', margin: 0 }}>{selected.notes}</p>
                  </div>
                )}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
