import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { attendanceApi, employeeApi } from '../services/api';

const STATUS_OPTIONS = ['present','absent','late','half_day','leave','holiday','overtime'];
const STATUS_COLOR   = { present:'#22c55e', absent:'#ef4444', late:'#f97316', half_day:'#f59e0b', leave:'#8b5cf6', holiday:'#6b7280', overtime:'#3b82f6' };
const LEAVE_TYPES    = ['','annual','sick','emergency','unpaid','maternity','other'];

export default function Attendance() {
  const { user } = useAuth();
  const { t }    = useLang();
  const role     = user?.role;
  const isLabor  = role === 'labor';
  const canEdit  = ['office_manager', 'owner'].includes(role);
  const isOwner  = role === 'owner';

  const [records,   setRecords]   = useState([]);
  const [employees, setEmployees] = useState([]);
  const [summary,   setSummary]   = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');

  const now = new Date();
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterMonth,    setFilterMonth]    = useState(now.getMonth()+1);
  const [filterYear,     setFilterYear]     = useState(now.getFullYear());
  const [filterStatus,   setFilterStatus]   = useState('');
  const [showForm,  setShowForm]  = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [bulkMode,  setBulkMode]  = useState(false);
  const [bulkDate,  setBulkDate]  = useState(new Date().toISOString().split('T')[0]);
  const [bulkRows,  setBulkRows]  = useState([]);

  const [form, setForm] = useState({
    employeeId:'', date: new Date().toISOString().split('T')[0],
    status:'present', checkIn:'08:00', checkOut:'17:00', leaveType:'', notes:'',
  });

  const load = async () => {
    setLoading(true); setError('');
    try {
      const params = { month: filterMonth, year: filterYear };
      if (role === 'labor') {
        const res = await attendanceApi.getMyAttendance(params);
        setRecords(res?.records || (Array.isArray(res) ? res : []));
        setSummary(res?.summary || null);
      } else {
        if (filterEmployee) params.employeeId = filterEmployee;
        if (filterStatus)   params.status     = filterStatus;
        const [res, sum] = await Promise.all([
          attendanceApi.getAll(params),
          attendanceApi.getSummary(filterMonth, filterYear),
        ]);
        setRecords(res?.records || []); setSummary(sum);
      }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filterEmployee, filterMonth, filterYear, filterStatus, role]);
  useEffect(() => {
    if (canEdit) {
      // Office Manager: only laborers. Owner/Admin: all active employees.
      const params = role === 'office_manager'
        ? { isActive: true, role: 'labor', limit: 200 }
        : { isActive: true, limit: 200 };
      employeeApi.getAll(params).then(r => {
        const emps = r?.employees || [];
        // Sort by employeeId (EMP-001, EMP-002, etc.)
        const sorted = emps.sort((a, b) => {
          const aId = a.employeeId || '';
          const bId = b.employeeId || '';
          return aId.localeCompare(bId);
        });
        setEmployees(sorted);
        setBulkRows(sorted.map(e => ({ employeeId: e._id||e.id, name: e.name, status:'present', checkIn:'08:00', checkOut:'17:00' })));
      }).catch(()=>{});
    }
  }, [canEdit, role]);

  const openCreate = () => {
    setEditing(null);
    setForm({ employeeId:'', date: new Date().toISOString().split('T')[0], status:'present', checkIn:'08:00', checkOut:'17:00', leaveType:'', notes:'' });
    setShowForm(true);
  };
  const openEdit = (r) => {
    setEditing(r);
    setForm({ employeeId: r.employeeId, date: r.date, status: r.status, checkIn: r.checkIn||'', checkOut: r.checkOut||'', leaveType: r.leaveType||'', notes: r.notes||'' });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.employeeId || !form.date) { setError('Employee and date are required.'); return; }
    setSaving(true); setError('');
    try {
      if (editing) await attendanceApi.update(editing._id||editing.id, form);
      else          await attendanceApi.create(form);
      setSuccess(editing ? 'Record updated!' : 'Attendance recorded!');
      setShowForm(false); load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleBulkSave = async () => {
    if (!bulkDate) { setError('Date is required.'); return; }
    setSaving(true); setError('');
    try {
      const res = await attendanceApi.createBulk(bulkDate, bulkRows);
      setSuccess(`Bulk saved — ${res.created} created, ${res.skipped} skipped.`);
      setBulkMode(false); load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this attendance record?')) return;
    try { await attendanceApi.remove(id); setSuccess('Deleted.'); load(); }
    catch (e) { setError(e.message); }
  };

  const updateBulkRow = (i, field, val) => {
    setBulkRows(rows => { const r=[...rows]; r[i]={...r[i],[field]:val}; return r; });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1><i className="fi fi-rr-user-time" style={{ marginRight:8, color:'#0891b2' }} />
            {isLabor ? t('myAttendanceTitle') : t('attendanceManagement')}
          </h1>
          {!isLabor && (
            <p style={{ fontSize:'0.82rem', color:'var(--text-muted)', margin:'4px 0 0' }}>
              {role === 'office_manager'
                ? (t('lang')==='am' ? 'ለሠራተኞች ዕለታዊ መቅረብ ምልክት ያድርጉ።' : 'Record and manage laborer daily attendance.')
                : (t('lang')==='am' ? 'ሁሉም ሠራተኞች የመቅረብ መዝገቦችን ይዩ።' : 'View and manage all employee attendance records.')}
            </p>
          )}
        </div>
        <div className="header-actions">
          {canEdit && <button className="btn btn-primary" onClick={openCreate}><i className="fi fi-rr-plus" style={{ marginRight:6 }} />{t('markAttendance')}</button>}
          {canEdit && <button className="btn btn-outline" onClick={()=>setBulkMode(true)}><i className="fi fi-rr-users-alt" style={{ marginRight:6 }} />{t('bulkAttendance')}</button>}
          <select value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} style={{ padding:'0.4rem 0.6rem', borderRadius:6, border:'1px solid var(--border)', fontSize:'0.85rem' }}>
            {[t('january'),t('february'),t('march'),t('april'),t('may'),t('june'),t('july'),t('august'),t('september'),t('october'),t('november'),t('december')].map((m,i)=><option key={i} value={i+1}>{m}</option>)}
          </select>
          <select value={filterYear} onChange={e=>setFilterYear(e.target.value)} style={{ padding:'0.4rem 0.6rem', borderRadius:6, border:'1px solid var(--border)', fontSize:'0.85rem' }}>
            {[2023,2024,2025,2026].map(y=><option key={y} value={y}>{y}</option>)}
          </select>
          {canEdit && (
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{ padding:'0.4rem 0.6rem', borderRadius:6, border:'1px solid var(--border)', fontSize:'0.85rem' }}>
              <option value="">{t('all')} {t('status')}</option>
              {STATUS_OPTIONS.map(s=><option key={s} value={s}>{t(s) || s}</option>)}
            </select>
          )}
          {canEdit && employees.length > 0 && (
            <select value={filterEmployee} onChange={e=>setFilterEmployee(e.target.value)} style={{ padding:'0.4rem 0.6rem', borderRadius:6, border:'1px solid var(--border)', fontSize:'0.85rem' }}>
              <option value="">{t('all')} {t('employees')}</option>
              {employees.map(e=><option key={e._id||e.id} value={e._id||e.id}>{e.employeeId} — {e.name}</option>)}
            </select>
          )}
          <button className="btn btn-outline btn-sm" onClick={load}><i className="fi fi-rr-refresh" /></button>
        </div>
      </div>

      {error   && <div className="alert alert-error"   style={{ marginBottom:'0.6rem' }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom:'0.6rem' }}>{success}</div>}

      {/* Role-specific info banners */}
      {isLabor && (
        <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', padding:'0.75rem 1rem', borderRadius:8, marginBottom:'1rem', color:'#1e40af', fontSize:'0.85rem', display:'flex', alignItems:'center', gap:8 }}>
          <i className="fi fi-rr-info" style={{ fontSize:'1.1rem', flexShrink:0 }} />
          <span>{t('lang')==='am' ? 'መቅረብዎ በቢሮ ሥራ አስኪያጅ ይመዘገባል። ይህ <strong>ለማንበብ ብቻ</strong> እይታ ነው።' : <>Your attendance is recorded by your Office Manager. This is a <strong>read-only</strong> view — contact your supervisor for any corrections.</>}</span>
        </div>
      )}
      {role === 'office_manager' && (
        <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', padding:'0.65rem 1rem', borderRadius:8, marginBottom:'1rem', color:'#166534', fontSize:'0.82rem', display:'flex', alignItems:'center', gap:8 }}>
          <i className="fi fi-rr-shield-check" style={{ flexShrink:0 }} />
          <span>{t('lang')==='am' ? 'ለሠራተኞች ብቻ መቅረብ ማስተዳደር ይችላሉ።' : <>You can record and manage attendance for <strong>Laborers only</strong>.</>}</span>
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div className="stats-grid" style={{ marginBottom:'1rem' }}>
          {[
            { icon:'fi-rr-check-circle', label:t('present'),   value: summary.present||0,              color:'success' },
            { icon:'fi-rr-user-remove',  label:t('absent'),    value: summary.absent||0,               color: summary.absent>0?'danger':'' },
            { icon:'fi-rr-clock',        label:t('late'),      value: summary.late||0,                 color:'' },
            { icon:'fi-rr-time-forward', label:t('leave'),     value: summary.leave||0,                color:'' },
            { icon:'fi-rr-calendar',     label:t('holiday'),   value: summary.holiday||0,              color:'' },
            { icon:'fi-rr-stopwatch',    label:t('workHours'), value: `${summary.totalWorkHours||0}h`, color:'info' },
            { icon:'fi-rr-alarm-clock',  label:t('overtime'),  value: `${summary.totalOvertimeHours||0}h`, color:'' },
            { icon:'fi-rr-users-alt',    label:t('totalLabel'),value: summary.total||0,                color:'' },
          ].map(s=>(
            <div key={s.label} className={`stat-card${s.color?' '+s.color:''}`}>
              <span className="stat-icon"><i className={`fi ${s.icon}`} /></span>
              <div className="stat-info"><label>{s.label}</label><strong>{s.value}</strong></div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign:'center', padding:'2rem', color:'var(--text-muted)' }}><i className="fi fi-rr-spinner" /> {t('loading')}</div>
      ) : records.length===0 ? (
        <div className="card" style={{ textAlign:'center', padding:'2.5rem' }}>
          <i className="fi fi-rr-user-time" style={{ fontSize:'2.5rem', color:'var(--text-muted)' }} />
          <p style={{ marginTop:'0.8rem', color:'var(--text-muted)' }}>{t('noAttendanceRecords')}</p>
        </div>
      ) : (
        <div className="card" style={{ padding:0, overflow:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.84rem' }}>
            <thead>
              <tr style={{ background:'#f9fafb', borderBottom:'2px solid var(--border)' }}>
                {[
                  ...(isLabor ? [] : [t('name')]),
                  t('date'),t('status'),t('checkIn'),t('checkOut'),t('workHours'),t('overtimeHours'),t('leaveType'),t('notes'),
                  ...(canEdit ? [t('action')] : []),
                ].map(h=>(
                  <th key={h} style={{ padding:'0.6rem 0.8rem', textAlign:'left', fontWeight:700, color:'var(--text-muted)', fontSize:'0.75rem', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map(r=>(
                <tr key={r._id||r.id} style={{ borderBottom:'1px solid var(--border)' }} className="table-row-hover">
                  {!isLabor && <td style={{ padding:'0.6rem 0.8rem', fontWeight:600 }}>{r.employeeName}</td>}
                  <td style={{ padding:'0.6rem 0.8rem', whiteSpace:'nowrap' }}>{r.date}</td>
                  <td style={{ padding:'0.6rem 0.8rem' }}>
                    <span style={{ fontSize:'0.72rem', fontWeight:700, background:(STATUS_COLOR[r.status]||'#6b7280')+'22', color:STATUS_COLOR[r.status]||'#6b7280', border:`1px solid ${STATUS_COLOR[r.status]||'#6b7280'}44`, borderRadius:20, padding:'2px 10px', textTransform:'capitalize' }}>{r.status?.replace('_',' ')}</span>
                  </td>
                  <td style={{ padding:'0.6rem 0.8rem' }}>{r.checkIn||'—'}</td>
                  <td style={{ padding:'0.6rem 0.8rem' }}>{r.checkOut||'—'}</td>
                  <td style={{ padding:'0.6rem 0.8rem' }}>{r.workHours||0}h</td>
                  <td style={{ padding:'0.6rem 0.8rem', color: r.overtimeHours>0?'#3b82f6':'var(--text-muted)' }}>{r.overtimeHours||0}h</td>
                  <td style={{ padding:'0.6rem 0.8rem', fontSize:'0.78rem', color:'var(--text-muted)' }}>{r.leaveType||'—'}</td>
                  <td style={{ padding:'0.6rem 0.8rem', color:'var(--text-muted)', maxWidth:150, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.notes||'—'}</td>
                  {canEdit && (
                    <td style={{ padding:'0.6rem 0.8rem', whiteSpace:'nowrap' }}>
                      <div style={{ display:'flex', gap:4 }}>
                        <button className="btn btn-outline btn-sm" onClick={()=>openEdit(r)} title="Edit"><i className="fi fi-rr-edit" /></button>
                        <button className="btn btn-sm" style={{ background:'#fee2e2', color:'#991b1b', border:'1px solid #fecaca', borderRadius:6, padding:'3px 8px' }} onClick={()=>handleDelete(r._id||r.id)} title="Delete"><i className="fi fi-rr-trash" /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Single record modal */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
          <div style={{ background:'#fff', borderRadius:14, padding:'1.5rem', width:'100%', maxWidth:480, boxShadow:'0 8px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontWeight:700, marginBottom:'1rem' }}><i className="fi fi-rr-user-time" style={{ marginRight:8 }} />{editing?t('edit')+' '+t('attendanceRecord'):t('markAttendance')}</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.7rem' }}>
              {!editing && <div className="form-group" style={{ gridColumn:'1/-1' }}><label>{t('name')} *</label>
                <select value={form.employeeId} onChange={e=>setForm(f=>({...f,employeeId:e.target.value}))}>
                  <option value="">{t('name')}…</option>
                  {employees.map(e=><option key={e._id||e.id} value={e._id||e.id}>{e.name}</option>)}
                </select>
              </div>}
              <div className="form-group"><label>{t('date')} *</label><input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} /></div>
              <div className="form-group"><label>{t('status')} *</label>
                <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                  {STATUS_OPTIONS.map(s=><option key={s} value={s}>{t(s)||s}</option>)}
                </select>
              </div>
              <div className="form-group"><label>{t('checkIn')}</label><input type="time" value={form.checkIn} onChange={e=>setForm(f=>({...f,checkIn:e.target.value}))} /></div>
              <div className="form-group"><label>{t('checkOut')}</label><input type="time" value={form.checkOut} onChange={e=>setForm(f=>({...f,checkOut:e.target.value}))} /></div>
              {form.status==='leave' && <div className="form-group" style={{ gridColumn:'1/-1' }}><label>{t('leaveType')}</label>
                <select value={form.leaveType} onChange={e=>setForm(f=>({...f,leaveType:e.target.value}))}>
                  {LEAVE_TYPES.map(l=><option key={l} value={l}>{l?t(l+'Leave')||l:'—'}</option>)}
                </select>
              </div>}
              <div className="form-group" style={{ gridColumn:'1/-1' }}><label>{t('notes')}</label><input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder={t('notes')} /></div>
            </div>
            <div style={{ display:'flex', gap:'0.5rem', justifyContent:'flex-end', marginTop:'0.8rem' }}>
              <button className="btn btn-outline" onClick={()=>setShowForm(false)}>{t('cancel')}</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?<i className="fi fi-rr-spinner" />:(editing?t('save'):t('submit'))}</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk modal */}
      {bulkMode && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'flex-start', justifyContent:'center', overflowY:'auto', padding:'1rem' }}>
          <div style={{ background:'#fff', borderRadius:14, padding:'1.5rem', width:'100%', maxWidth:760, marginTop:'2rem', boxShadow:'0 8px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontWeight:700, marginBottom:'0.8rem' }}><i className="fi fi-rr-users-alt" style={{ marginRight:8 }} />{t('markBulkAttendance')}</h3>
            <div className="form-group" style={{ marginBottom:'0.8rem' }}>
              <label>{t('date')} *</label>
              <input type="date" value={bulkDate} onChange={e=>setBulkDate(e.target.value)} style={{ maxWidth:200 }} />
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.83rem' }}>
                <thead><tr style={{ background:'#f9fafb', borderBottom:'2px solid var(--border)' }}>
                  {[t('name'),t('status'),t('checkIn'),t('checkOut')].map(h=><th key={h} style={{ padding:'0.5rem', textAlign:'left', fontWeight:700, color:'var(--text-muted)', fontSize:'0.75rem' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {bulkRows.map((r,i)=>(
                    <tr key={r.employeeId} style={{ borderBottom:'1px solid var(--border)' }}>
                      <td style={{ padding:'0.4rem 0.5rem', fontWeight:600 }}>{r.name}</td>
                      <td style={{ padding:'0.4rem 0.5rem' }}>
                        <select value={r.status} onChange={e=>updateBulkRow(i,'status',e.target.value)} style={{ padding:'0.25rem 0.4rem', borderRadius:4, border:'1px solid var(--border)', fontSize:'0.82rem' }}>
                          {STATUS_OPTIONS.map(s=><option key={s} value={s}>{t(s)||s}</option>)}
                        </select>
                      </td>
                      <td style={{ padding:'0.4rem 0.5rem' }}><input type="time" value={r.checkIn} onChange={e=>updateBulkRow(i,'checkIn',e.target.value)} style={{ padding:'0.25rem', borderRadius:4, border:'1px solid var(--border)', fontSize:'0.82rem' }} /></td>
                      <td style={{ padding:'0.4rem 0.5rem' }}><input type="time" value={r.checkOut} onChange={e=>updateBulkRow(i,'checkOut',e.target.value)} style={{ padding:'0.25rem', borderRadius:4, border:'1px solid var(--border)', fontSize:'0.82rem' }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display:'flex', gap:'0.5rem', justifyContent:'flex-end', marginTop:'0.8rem' }}>
              <button className="btn btn-outline" onClick={()=>setBulkMode(false)}>{t('cancel')}</button>
              <button className="btn btn-primary" onClick={handleBulkSave} disabled={saving}>{saving?<i className="fi fi-rr-spinner" />:t('save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
