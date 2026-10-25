import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { zoneApi } from '../services/api';

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

const EMPTY = { farmId: '', farmName: '', day: 'Mon', startTime: '06:00', duration: 30, autoMode: true, active: true, notes: '' };

export default function IrrigationSchedule() {
  const { user } = useAuth();
  const { t }    = useLang();
  const isOwner  = user?.role === 'owner';
  const canEdit  = user?.role === 'admin' || isOwner;

  const [farms, setFarms]         = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [toast, setToast]         = useState('');
  const [showForm, setShowForm]   = useState(false);
  const [editId, setEditId]       = useState(null);
  const [form, setForm]           = useState(EMPTY);
  const [filterDay, setFilterDay] = useState('All');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2800); };

  // Load farms (zones) from backend
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await zoneApi.getAll();
      setFarms(data);
      // Build schedules from farm schedule fields
      const built = data
        .filter(f => f.schedule)
        .map((f, i) => ({
          id:        f.id || f._id || i,
          farmId:    f.id || f._id,
          farmName:  f.name,
          day:       'Daily',
          startTime: f.schedule,
          duration:  f.duration || 30,
          autoMode:  true,
          active:    f.active,
          notes:     f.crop ? `Crop: ${f.crop}` : '',
        }));
      setSchedules(built);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditId(null); setForm(EMPTY); setShowForm(true); };
  const openEdit   = (s) => {
    setEditId(s.id);
    setForm({ farmId: s.farmId, farmName: s.farmName, day: s.day, startTime: s.startTime, duration: s.duration, autoMode: s.autoMode, active: s.active, notes: s.notes });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.farmName) { setError('Farm is required.'); return; }
    if (editId) {
      setSchedules(prev => prev.map(s => s.id === editId ? { ...s, ...form } : s));
    } else {
      setSchedules(prev => [...prev, { id: Date.now(), ...form }]);
      // Also persist startTime/duration to backend
      const farm = farms.find(f => f.name === form.farmName);
      if (farm) {
        try { await zoneApi.update(farm.id || farm._id, { schedule: form.startTime, duration: Number(form.duration) }); }
        catch (_) {}
      }
    }
    showToast(editId ? 'Schedule updated.' : 'Schedule added.');
    setShowForm(false); setEditId(null);
  };

  const handleDelete = (id) => {
    setSchedules(prev => prev.filter(s => s.id !== id));
    showToast('Schedule removed.');
  };

  const handleToggle = (id) => {
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, active: !s.active } : s));
  };

  const filtered = filterDay === 'All' ? schedules : schedules.filter(s => s.day === filterDay || s.day === 'Daily');

  return (
    <div>
      <div className="page-header">
        <h1><i className="fi fi-rr-water-ladder" style={{ marginRight: 8 }} />{t('irrigationScheduleTitle')}</h1>
        <div className="header-actions">
          {canEdit && !isOwner && (
            <button className="btn btn-primary btn-sm" onClick={openCreate}>
              <i className="fi fi-rr-plus" style={{ marginRight: 4 }} />{t('addSchedule')}
            </button>
          )}
          <button className="btn btn-outline btn-sm" onClick={load}><i className="fi fi-rr-refresh" /></button>
        </div>
      </div>

      {toast && <div className="alert alert-success"><i className="fi fi-rr-check" style={{ marginRight: 6 }} />{toast}</div>}
      {error && <div className="alert alert-error"><i className="fi fi-rr-triangle-warning" style={{ marginRight: 6 }} />{error}</div>}

      {/* Day filter */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {['All', 'Daily', ...DAYS].map(d => (
          <button key={d} onClick={() => setFilterDay(d)}
            className={`btn btn-sm ${filterDay === d ? 'btn-primary' : 'btn-outline'}`}>{d}</button>
        ))}
      </div>

      {/* Add / Edit form */}
      {showForm && canEdit && (
        <div className="card" style={{ marginBottom: '1rem', borderLeft: '4px solid var(--primary)' }}>
          <div className="card-header">
            <span className="card-title"><i className="fi fi-rr-edit" style={{ marginRight: 6 }} />{editId ? 'Edit Schedule' : 'New Schedule'}</span>
            <button className="btn btn-outline btn-sm" onClick={() => setShowForm(false)}>✕</button>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Farm *</label>
              <select value={form.farmName} onChange={e => setForm({ ...form, farmName: e.target.value })}>
                <option value="">— Select farm —</option>
                {farms.map(f => <option key={f.id || f._id} value={f.name}>{f.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Day</label>
              <select value={form.day} onChange={e => setForm({ ...form, day: e.target.value })}>
                <option value="Daily">Daily</option>
                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Start Time</label>
              <input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Duration (min)</label>
              <input type="number" min="1" max="1440" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Notes</label>
              <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional…" />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 22 }}>
              <label className="toggle-switch">
                <input type="checkbox" checked={form.autoMode} onChange={e => setForm({ ...form, autoMode: e.target.checked })} />
                <span className="toggle-slider" />
              </label>
              <span style={{ fontSize: '0.85rem' }}>Auto Mode</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-primary" onClick={handleSave}><i className="fi fi-rr-check" style={{ marginRight: 4 }} />{editId ? t('saveChanges') : t('addSchedule')}</button>
            <button className="btn btn-outline" onClick={() => setShowForm(false)}>{t('cancel')}</button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {[1,2,3].map(i => <div key={i} style={{ height: 64, background: '#e5e7eb', borderRadius: 10, animation: 'pulse 1.5s infinite' }}><style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style></div>)}
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div className="chart-box"><span className="ch-icon"><i className="fi fi-rr-calendar" /></span>{t('noSchedules')}</div>
      )}

      {/* Schedule table */}
      {!loading && filtered.length > 0 && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Farm</th><th>Day</th><th>Start Time</th><th>Duration</th>
                  <th>Mode</th><th>Status</th><th>Notes</th>
                  {canEdit && <th style={{ textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}><i className="fi fi-rr-seedling" style={{ marginRight: 6, color: 'var(--primary)' }} />{s.farmName}</td>
                    <td>{s.day}</td>
                    <td><i className="fi fi-rr-clock" style={{ marginRight: 4, color: 'var(--text-muted)' }} />{s.startTime}</td>
                    <td>{s.duration} min</td>
                    <td>
                      <span style={{ fontSize: '0.75rem', background: s.autoMode ? '#dbeafe' : '#f3f4f6', color: s.autoMode ? '#1e40af' : '#6b7280', borderRadius: 20, padding: '2px 10px', fontWeight: 600 }}>
                        {s.autoMode ? 'Auto' : 'Manual'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${s.active ? 'badge-success' : 'badge-gray'}`}>{s.active ? 'Active' : 'Paused'}</span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: 160 }}>{s.notes || '—'}</td>
                    {canEdit && (
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                          <button className="btn btn-outline btn-sm" title={s.active ? 'Pause' : 'Activate'} onClick={() => handleToggle(s.id)}>
                            <i className={`fi ${s.active ? 'fi-rr-pause' : 'fi-rr-play'}`} />
                          </button>
                          {!isOwner && <button className="btn btn-outline btn-sm" onClick={() => openEdit(s)}><i className="fi fi-rr-edit" /></button>}
                          {!isOwner && <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(s.id)}><i className="fi fi-rr-trash" /></button>}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
