import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const EQUIPMENT_TYPES = ['Irrigation Pipe','Water Pump','Valve','Sensor Device','Sprinkler Head','Filter','Power Unit','Other'];
const CONDITION_OPTIONS = ['Good','Fair','Needs Maintenance','Faulty','Replaced'];
const CONDITION_COLOR   = { Good: '#22c55e', Fair: '#f59e0b', 'Needs Maintenance': '#ef4444', Faulty: '#7f1d1d', Replaced: '#3b82f6' };

const today = new Date().toISOString().split('T')[0];

const SAMPLE_ITEMS = [
  { id: 1, equipment: 'Water Pump',    location: 'Farm 1 - North', condition: 'Good',              lastChecked: today,      notes: 'Running normally', reportedToAdmin: false },
  { id: 2, equipment: 'Irrigation Pipe',location:'Farm 1 - East', condition: 'Needs Maintenance',  lastChecked: today,      notes: 'Small leak detected at joint 3', reportedToAdmin: true },
  { id: 3, equipment: 'Sensor Device', location: 'Farm 2',         condition: 'Good',              lastChecked: today,      notes: 'Calibrated successfully', reportedToAdmin: false },
  { id: 4, equipment: 'Valve',         location: 'Farm 2 - South', condition: 'Faulty',            lastChecked: today,      notes: 'Valve stuck — cannot open manually', reportedToAdmin: true },
  { id: 5, equipment: 'Sprinkler Head',location: 'Farm 3',         condition: 'Fair',              lastChecked: today,      notes: 'Partial blockage', reportedToAdmin: false },
];

const EMPTY = { equipment: 'Water Pump', location: '', condition: 'Good', notes: '', reportedToAdmin: false };

export default function Inspection() {
  const { user } = useAuth();

  const [items, setItems]           = useState(SAMPLE_ITEMS);
  const [showForm, setShowForm]     = useState(false);
  const [editId, setEditId]         = useState(null);
  const [form, setForm]             = useState(EMPTY);
  const [toast, setToast]           = useState('');
  const [filterCond, setFilterCond] = useState('All');
  const [search, setSearch]         = useState('');

  // Work notes / maintenance log
  const [notes, setNotes]           = useState([
    { id: 1, date: today, text: 'Completed pump inspection on Farm 1. All valves operational.', author: user?.name || 'Laborer' },
    { id: 2, date: today, text: 'Reported leaking pipe to admin. Awaiting replacement parts.', author: user?.name || 'Laborer' },
  ]);
  const [newNote, setNewNote]       = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const openCreate = () => { setEditId(null); setForm(EMPTY); setShowForm(true); };
  const openEdit   = (item) => { setEditId(item.id); setForm({ equipment: item.equipment, location: item.location, condition: item.condition, notes: item.notes, reportedToAdmin: item.reportedToAdmin }); setShowForm(true); };

  const handleSave = () => {
    if (!form.location.trim()) { return; }
    if (editId) {
      setItems(prev => prev.map(i => i.id === editId ? { ...i, ...form, lastChecked: today } : i));
      showToast('Inspection record updated.');
    } else {
      setItems(prev => [...prev, { id: Date.now(), ...form, lastChecked: today }]);
      showToast('Equipment inspection logged.');
    }
    setShowForm(false); setEditId(null);
  };

  const reportToAdmin = (id) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, reportedToAdmin: true } : i));
    showToast('Problem reported to Admin.');
  };

  const addNote = () => {
    if (!newNote.trim()) return;
    setNotes(prev => [{ id: Date.now(), date: today, text: newNote.trim(), author: user?.name || 'Laborer' }, ...prev]);
    setNewNote('');
    showToast('Work note added.');
  };

  const filtered = items.filter(i => {
    const matchCond = filterCond === 'All' || i.condition === filterCond;
    const matchSearch = !search || i.equipment.toLowerCase().includes(search.toLowerCase()) || i.location.toLowerCase().includes(search.toLowerCase());
    return matchCond && matchSearch;
  });

  const counts = {
    total:   items.length,
    good:    items.filter(i => i.condition === 'Good').length,
    issues:  items.filter(i => ['Needs Maintenance','Faulty'].includes(i.condition)).length,
    reported: items.filter(i => i.reportedToAdmin).length,
  };

  return (
    <div>
      <div className="page-header">
        <h1><i className="fi fi-rr-tools" style={{ marginRight: 8 }} />Equipment Inspection</h1>
        <p>Inspect and log the condition of irrigation pipes, pumps, valves and sensor devices. Report problems to the Admin.</p>
        <div className="header-actions">
          <button className="btn btn-primary btn-sm" onClick={openCreate}><i className="fi fi-rr-plus" style={{ marginRight: 4 }} />Log Inspection</button>
          <button className="btn btn-outline btn-sm" onClick={() => setItems(SAMPLE_ITEMS)}><i className="fi fi-rr-refresh" /></button>
        </div>
      </div>

      {toast && <div className="alert alert-success"><i className="fi fi-rr-check" style={{ marginRight: 6 }} />{toast}</div>}

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: '1rem' }}>
        <div className="stat-card"><span className="stat-icon"><i className="fi fi-rr-tools" /></span><div className="stat-info"><label>Total Equipment</label><strong>{counts.total}</strong><span>inspected</span></div></div>
        <div className="stat-card success"><span className="stat-icon"><i className="fi fi-rr-check-circle" /></span><div className="stat-info"><label>Good Condition</label><strong>{counts.good}</strong></div></div>
        <div className="stat-card danger"><span className="stat-icon"><i className="fi fi-rr-triangle-warning" /></span><div className="stat-info"><label>Issues Found</label><strong>{counts.issues}</strong><span>{counts.issues > 0 ? 'needs action' : 'all clear'}</span></div></div>
        <div className="stat-card info"><span className="stat-icon"><i className="fi fi-rr-bell-ring" /></span><div className="stat-info"><label>Reported to Admin</label><strong>{counts.reported}</strong></div></div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: '1rem', borderLeft: '4px solid var(--primary)' }}>
          <div className="card-header">
            <span className="card-title"><i className="fi fi-rr-edit" style={{ marginRight: 6 }} />{editId ? 'Update Inspection' : 'Log New Inspection'}</span>
            <button className="btn btn-outline btn-sm" onClick={() => setShowForm(false)}>✕</button>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Equipment Type *</label>
              <select value={form.equipment} onChange={e => setForm({ ...form, equipment: e.target.value })}>
                {EQUIPMENT_TYPES.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Location / Farm *</label><input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="e.g. Farm 2 - North Section" /></div>
            <div className="form-group"><label>Condition</label>
              <select value={form.condition} onChange={e => setForm({ ...form, condition: e.target.value })}>
                {CONDITION_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Inspection Notes</label>
              <textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Describe what you found, actions taken, parts needed…" maxLength={300}
                style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', resize: 'vertical', fontSize: '0.88rem' }} />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 22 }}>
              <label className="toggle-switch">
                <input type="checkbox" checked={form.reportedToAdmin} onChange={e => setForm({ ...form, reportedToAdmin: e.target.checked })} />
                <span className="toggle-slider" />
              </label>
              <span style={{ fontSize: '0.85rem' }}>Report problem to Admin</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-primary" onClick={handleSave}><i className="fi fi-rr-check" style={{ marginRight: 4 }} />{editId ? 'Update Record' : 'Log Inspection'}</button>
            <button className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
          <i className="fi fi-rr-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.85rem' }} />
          <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search equipment or location…" style={{ width: '100%', paddingLeft: 32 }} />
        </div>
        {['All', ...CONDITION_OPTIONS].map(c => (
          <button key={c} onClick={() => setFilterCond(c)}
            className={`btn btn-sm ${filterCond === c ? 'btn-primary' : 'btn-outline'}`}
            style={{ whiteSpace: 'nowrap' }}>{c}</button>
        ))}
      </div>

      {/* Equipment list */}
      {filtered.length === 0
        ? <div className="chart-box"><span className="ch-icon"><i className="fi fi-rr-tools" /></span>No equipment records found.</div>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.5rem' }}>
            {filtered.map(item => {
              const cc = CONDITION_COLOR[item.condition] || '#6b7280';
              return (
                <div key={item.id} style={{ background: '#fff', borderRadius: 10, padding: '0.85rem 1.1rem', boxShadow: '0 2px 6px rgba(0,0,0,0.05)', borderLeft: `4px solid ${cc}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{item.equipment}</span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, background: cc + '18', color: cc, border: `1px solid ${cc}44`, borderRadius: 20, padding: '2px 10px' }}>{item.condition}</span>
                      {item.reportedToAdmin && (
                        <span style={{ fontSize: '0.7rem', background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd', borderRadius: 20, padding: '2px 10px', fontWeight: 600 }}>
                          <i className="fi fi-rr-bell-ring" style={{ marginRight: 3 }} />Reported
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 4, flexWrap: 'wrap' }}>
                      <span><i className="fi fi-rr-map-marker" style={{ marginRight: 3 }} />{item.location}</span>
                      <span><i className="fi fi-rr-calendar" style={{ marginRight: 3 }} />Checked: {item.lastChecked}</span>
                    </div>
                    {item.notes && <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>{item.notes}</p>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flexShrink: 0 }}>
                    <button className="btn btn-outline btn-sm" onClick={() => openEdit(item)}><i className="fi fi-rr-edit" style={{ marginRight: 4 }} />Update</button>
                    {!item.reportedToAdmin && ['Needs Maintenance','Faulty'].includes(item.condition) && (
                      <button className="btn btn-outline btn-sm" style={{ borderColor: '#ef4444', color: '#dc2626' }} onClick={() => reportToAdmin(item.id)}>
                        <i className="fi fi-rr-bell-ring" style={{ marginRight: 4 }} />Report to Admin
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      {/* Work Notes / Maintenance Log */}
      <div className="card">
        <div className="card-header">
          <span className="card-title"><i className="fi fi-rr-document" style={{ marginRight: 6 }} />Work Notes &amp; Maintenance Log</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <input value={newNote} onChange={e => setNewNote(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNote()}
            placeholder="Add a work note or maintenance observation…" style={{ flex: 1, fontSize: '0.88rem' }} />
          <button className="btn btn-primary btn-sm" onClick={addNote} disabled={!newNote.trim()}>
            <i className="fi fi-rr-plus" style={{ marginRight: 4 }} />Add Note
          </button>
        </div>
        {notes.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {notes.map(n => (
              <div key={n.id} style={{ background: '#f9fafb', borderRadius: 8, padding: '0.6rem 0.85rem', fontSize: '0.85rem', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, color: 'var(--primary-dark)' }}>{n.author}</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{n.date}</span>
                </div>
                <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.55 }}>{n.text}</p>
              </div>
            ))}
          </div>
        ) : <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem 0', fontSize: '0.85rem' }}>No work notes yet.</p>}
      </div>
    </div>
  );
}
