import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const DAYS     = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const SHIFTS   = ['Morning (6am–2pm)', 'Afternoon (2pm–10pm)', 'Night (10pm–6am)', 'Full Day (8am–5pm)'];
const ROLES_F  = ['All Roles', 'labor', 'admin', 'office_manager'];

const SAMPLE_SCHEDULES = [
  { id: 1, name: 'Abebe Kebede',  role: 'labor',  day: 'Monday',    shift: 'Morning (6am–2pm)',    task: 'Inspect pump valves — Farm 1', status: 'confirmed' },
  { id: 2, name: 'Fatuma Ali',    role: 'labor',  day: 'Monday',    shift: 'Afternoon (2pm–10pm)', task: 'Sensor maintenance — Farm 2',  status: 'confirmed' },
  { id: 3, name: 'Kebede Haile',  role: 'admin',  day: 'Tuesday',   shift: 'Full Day (8am–5pm)',   task: 'System audit — All farms',     status: 'pending'   },
  { id: 4, name: 'Almaz Tadesse', role: 'labor',  day: 'Wednesday', shift: 'Morning (6am–2pm)',    task: 'Irrigation pipe check',        status: 'confirmed' },
  { id: 5, name: 'Bereket Seyum', role: 'labor',  day: 'Thursday',  shift: 'Morning (6am–2pm)',    task: 'Water pump maintenance',       status: 'pending'   },
];

const STATUS_COLOR = { confirmed: '#22c55e', pending: '#f59e0b', cancelled: '#ef4444' };

const EMPTY = { name: '', role: 'labor', day: 'Monday', shift: SHIFTS[0], task: '', status: 'pending' };

export default function Schedule() {
  const { user } = useAuth();
  const isOM     = user?.role === 'office_manager';

  const [schedules, setSchedules] = useState(SAMPLE_SCHEDULES);
  const [filterDay, setFilterDay] = useState('All');
  const [filterRole, setFilterRole] = useState('All Roles');
  const [showForm, setShowForm]   = useState(false);
  const [editId, setEditId]       = useState(null);
  const [form, setForm]           = useState(EMPTY);
  const [toast, setToast]         = useState('');
  const [search, setSearch]       = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const openCreate = () => { setEditId(null); setForm(EMPTY); setShowForm(true); };
  const openEdit   = (s) => { setEditId(s.id); setForm({ name: s.name, role: s.role, day: s.day, shift: s.shift, task: s.task, status: s.status }); setShowForm(true); };

  const handleSave = () => {
    if (!form.name.trim() || !form.task.trim()) return;
    if (editId) {
      setSchedules(prev => prev.map(s => s.id === editId ? { ...s, ...form } : s));
      showToast('Schedule updated.');
    } else {
      setSchedules(prev => [...prev, { id: Date.now(), ...form }]);
      showToast('Schedule created.');
    }
    setShowForm(false); setEditId(null);
  };

  const handleDelete = (id) => { setSchedules(prev => prev.filter(s => s.id !== id)); showToast('Schedule removed.'); };
  const handleStatus = (id, status) => { setSchedules(prev => prev.map(s => s.id === id ? { ...s, status } : s)); };

  const filtered = schedules.filter(s => {
    const matchDay  = filterDay === 'All'   || s.day === filterDay;
    const matchRole = filterRole === 'All Roles' || s.role === filterRole;
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.task.toLowerCase().includes(search.toLowerCase());
    return matchDay && matchRole && matchSearch;
  });

  const counts = { total: schedules.length, confirmed: schedules.filter(s => s.status === 'confirmed').length, pending: schedules.filter(s => s.status === 'pending').length };

  return (
    <div>
      <div className="page-header">
        <h1><i className="fi fi-rr-calendar-lines" style={{ marginRight: 8 }} />Work Schedules</h1>
        <div className="header-actions">
          <button className="btn btn-primary btn-sm" onClick={openCreate}><i className="fi fi-rr-plus" style={{ marginRight: 4 }} />Add Schedule</button>
          <button className="btn btn-outline btn-sm" onClick={() => setSchedules(SAMPLE_SCHEDULES)}><i className="fi fi-rr-refresh" /></button>
        </div>
      </div>

      {toast && <div className="alert alert-success"><i className="fi fi-rr-check" style={{ marginRight: 6 }} />{toast}</div>}

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: '1rem' }}>
        <div className="stat-card"><span className="stat-icon"><i className="fi fi-rr-users-alt" /></span><div className="stat-info"><label>Total Shifts</label><strong>{counts.total}</strong></div></div>
        <div className="stat-card success"><span className="stat-icon"><i className="fi fi-rr-check-circle" /></span><div className="stat-info"><label>Confirmed</label><strong>{counts.confirmed}</strong></div></div>
        <div className="stat-card"><span className="stat-icon"><i className="fi fi-rr-clock" /></span><div className="stat-info"><label>Pending</label><strong>{counts.pending}</strong><span style={{ color: counts.pending > 0 ? '#f59e0b' : '' }}>{counts.pending > 0 ? 'needs action' : 'all clear'}</span></div></div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
          <i className="fi fi-rr-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.85rem' }} />
          <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or task…" style={{ width: '100%', paddingLeft: 32 }} />
        </div>
        <select value={filterDay} onChange={e => setFilterDay(e.target.value)} style={{ width: 'auto' }}>
          <option value="All">All Days</option>
          {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)} style={{ width: 'auto' }}>
          {ROLES_F.map(r => <option key={r} value={r}>{r === 'All Roles' ? 'All Roles' : r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
        </select>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: '1rem', borderLeft: '4px solid var(--primary)' }}>
          <div className="card-header">
            <span className="card-title"><i className="fi fi-rr-edit" style={{ marginRight: 6 }} />{editId ? 'Edit Schedule' : 'New Schedule'}</span>
            <button className="btn btn-outline btn-sm" onClick={() => setShowForm(false)}>✕</button>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Employee Name *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full name" /></div>
            <div className="form-group"><label>Role</label>
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                <option value="labor">Laborer</option><option value="office_manager">Office Manager</option><option value="admin">Admin</option>
              </select>
            </div>
            <div className="form-group"><label>Day</label>
              <select value={form.day} onChange={e => setForm({ ...form, day: e.target.value })}>
                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Shift</label>
              <select value={form.shift} onChange={e => setForm({ ...form, shift: e.target.value })}>
                {SHIFTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Task / Assignment *</label><input value={form.task} onChange={e => setForm({ ...form, task: e.target.value })} placeholder="e.g. Inspect irrigation pipes in Farm 2" /></div>
            <div className="form-group"><label>Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-primary" onClick={handleSave}><i className="fi fi-rr-check" style={{ marginRight: 4 }} />{editId ? 'Save Changes' : 'Add Schedule'}</button>
            <button className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0
        ? <div className="chart-box"><span className="ch-icon"><i className="fi fi-rr-calendar-lines" /></span>No schedules match your filter.</div>
        : (
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Employee</th><th>Role</th><th>Day</th><th>Shift</th><th>Task</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
                </thead>
                <tbody>
                  {filtered.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td><span style={{ fontSize: '0.75rem', textTransform: 'capitalize', background: '#f3f4f6', borderRadius: 20, padding: '2px 8px' }}>{s.role}</span></td>
                      <td>{s.day}</td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{s.shift}</td>
                      <td style={{ fontSize: '0.83rem', maxWidth: 200 }}>{s.task}</td>
                      <td>
                        <select value={s.status} onChange={e => handleStatus(s.id, e.target.value)}
                          style={{ fontSize: '0.75rem', fontWeight: 700, color: STATUS_COLOR[s.status], background: STATUS_COLOR[s.status] + '18', border: `1px solid ${STATUS_COLOR[s.status]}44`, borderRadius: 20, padding: '2px 8px', cursor: 'pointer' }}>
                          <option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                          <button className="btn btn-outline btn-sm" onClick={() => openEdit(s)}><i className="fi fi-rr-edit" /></button>
                          <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(s.id)}><i className="fi fi-rr-trash" /></button>
                        </div>
                      </td>
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
