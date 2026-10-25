/**
 * MyAttendancePage — Laborer's own attendance record (read-only)
 * Shows monthly summary + daily records. Laborer cannot edit or approve.
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { attendanceApi } from '../services/api';

const STATUS_STYLE = {
  present:  { bg: '#dcfce7', color: '#166534', border: '#86efac', labelKey: 'present'  },
  absent:   { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5', labelKey: 'absent'   },
  late:     { bg: '#ffedd5', color: '#c2410c', border: '#fed7aa', labelKey: 'late'     },
  half_day: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d', labelKey: 'halfDay'  },
  leave:    { bg: '#f3e8ff', color: '#6b21a8', border: '#d8b4fe', labelKey: 'leave'    },
  holiday:  { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1', labelKey: 'holiday'  },
  overtime: { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd', labelKey: 'overtime' },
};

const LEAVE_LABEL_KEYS = {
  annual: 'annualLeave', sick: 'sickLeave', emergency: 'emergencyLeave',
  unpaid: 'unpaidLeave', maternity: 'maternityLeave', other: 'other',
};

export default function MyAttendancePage() {
  const { user } = useAuth();
  const { t }    = useLang();

  const MONTHS = [
    t('january'),t('february'),t('march'),t('april'),
    t('may'),t('june'),t('july'),t('august'),
    t('september'),t('october'),t('november'),t('december'),
  ];

  const now   = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year,  setYear]  = useState(now.getFullYear());

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await attendanceApi.getMe({ month, year });
      setRecords(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  // Monthly summary
  const summary = records.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    acc.totalWork     = (acc.totalWork     || 0) + (r.workHours     || 0);
    acc.totalOvertime = (acc.totalOvertime || 0) + (r.overtimeHours || 0);
    acc.totalLate     = (acc.totalLate     || 0) + (r.lateMinutes   || 0);
    return acc;
  }, {});

  const presentDays  = (summary.present || 0) + (summary.late || 0) + (summary.half_day || 0) + (summary.overtime || 0);
  const absentDays   = summary.absent  || 0;
  const leaveDays    = summary.leave   || 0;
  const overtimeHrs  = +(summary.totalOvertime || 0).toFixed(1);
  const workHrs      = +(summary.totalWork     || 0).toFixed(1);
  const lateMinutes  = summary.totalLate || 0;

  const monthLabel = `${MONTHS[month - 1]} ${year}`;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', paddingBottom: '2rem' }}>
      {/* Header */}
      <div className="page-header">
        <h1><i className="fi fi-rr-user-time" style={{ marginRight: 8, color: '#3b82f6' }} />{t('myAttendanceTitle')}</h1>
        <div className="header-actions">
          <select
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            style={{ padding: '0.4rem 0.7rem', borderRadius: 8, border: '1px solid var(--border)', fontSize: '0.85rem' }}
          >
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            style={{ padding: '0.4rem 0.7rem', borderRadius: 8, border: '1px solid var(--border)', fontSize: '0.85rem' }}
          >
            {[now.getFullYear() - 1, now.getFullYear()].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="btn btn-outline btn-sm" onClick={load}><i className="fi fi-rr-refresh" /></button>
        </div>
      </div>

      {error && <div className="alert alert-error"><i className="fi fi-rr-triangle-warning" style={{ marginRight: 6 }} />{error}</div>}

      {/* Info notice */}
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '0.65rem 1rem', marginBottom: '1rem', fontSize: '0.83rem', color: '#1e40af', display: 'flex', alignItems: 'center', gap: 8 }}>
        <i className="fi fi-rr-info" />
        Attendance is recorded by your Office Manager. Contact your supervisor for any corrections.
      </div>

      {/* Monthly Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {[
          { label: t('presentDays'), value: presentDays,  icon: 'fi-rr-check-circle',  color: '#166534', bg: '#dcfce7' },
          { label: t('absentDays'),  value: absentDays,   icon: 'fi-rr-user-remove',   color: '#991b1b', bg: '#fee2e2' },
          { label: t('leaveDays'),   value: leaveDays,    icon: 'fi-rr-calendar-minus', color: '#6b21a8', bg: '#f3e8ff' },
          { label: t('workHours'),   value: `${workHrs}h`,       icon: 'fi-rr-clock',        color: '#0369a1', bg: '#e0f2fe' },
          { label: t('overtime'),    value: `${overtimeHrs}h`,   icon: 'fi-rr-time-forward', color: '#c2410c', bg: '#ffedd5' },
          { label: t('late'),        value: `${lateMinutes}m`,   icon: 'fi-rr-alarm-clock',  color: '#92400e', bg: '#fef3c7' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.color}33`, borderRadius: 10, padding: '0.75rem', textAlign: 'center' }}>
            <i className={`fi ${s.icon}`} style={{ color: s.color, fontSize: '1.3rem', display: 'block', marginBottom: 4 }} />
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Records */}
      <div className="card" style={{ padding: 0 }}>
        <div className="card-header" style={{ padding: '0.75rem 1rem' }}>
          <span className="card-title">
            <i className="fi fi-rr-calendar" style={{ marginRight: 6 }} />{monthLabel} — Attendance Record
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{records.length} day{records.length !== 1 ? 's' : ''} recorded</span>
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            <i className="fi fi-rr-spinner" style={{ fontSize: '1.4rem', display: 'block', marginBottom: 8 }} />Loading...
          </div>
        ) : records.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <i className="fi fi-rr-calendar" style={{ fontSize: '2.5rem', display: 'block', marginBottom: 10, color: '#d1d5db' }} />
            <p style={{ margin: 0 }}>{t('noAttendanceRecords')}</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Work Hours</th>
                  <th>Overtime</th>
                  <th>Leave Type</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {records.sort((a, b) => a.date.localeCompare(b.date)).map(r => {
                  const st = STATUS_STYLE[r.status] || STATUS_STYLE.present;
                  return (
                    <tr key={r._id || r.id}>
                      <td style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                        {new Date(r.date + 'T00:00:00').toLocaleDateString('en-ET', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </td>
                      <td>
                        <span style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}`, borderRadius: 20, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700 }}>
                          {t(st.labelKey)}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>{r.checkIn  || '—'}</td>
                      <td style={{ fontSize: '0.85rem' }}>{r.checkOut || '—'}</td>
                      <td style={{ fontSize: '0.85rem', fontWeight: r.workHours > 0 ? 600 : 400 }}>
                        {r.workHours > 0 ? `${r.workHours}h` : '—'}
                      </td>
                      <td style={{ fontSize: '0.85rem', color: r.overtimeHours > 0 ? '#c2410c' : 'var(--text-muted)' }}>
                        {r.overtimeHours > 0 ? `${r.overtimeHours}h` : '—'}
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {r.leaveType ? (t(LEAVE_LABEL_KEYS[r.leaveType]) || r.leaveType) : '—'}
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: 160 }}>
                        {r.notes || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
