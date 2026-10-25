import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { taskApi, userApi, zoneApi } from '../services/api';

const PRIORITY_COLOR = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };
const PRIORITY_BG    = { high: '#fef2f2', medium: '#fffbeb', low: '#f0fdf4' };
const STATUS_COLOR   = {
  pending:            '#6b7280',
  in_progress:        '#3b82f6',
  completed:          '#22c55e',
  reviewed:           '#8b5cf6',
  overdue:            '#ef4444',
  unable_to_complete: '#f97316',
};
const STATUS_LABEL   = {
  pending:            'Pending',
  in_progress:        'In Progress',
  completed:          'Completed',
  reviewed:           'Reviewed',
  overdue:            'Overdue',
  unable_to_complete: 'Unable to Complete',
};
// Laborer can advance overdue tasks just like pending (still needs to be done)
const STATUS_NEXT    = {
  pending:     'in_progress',
  in_progress: 'completed',
  overdue:     'in_progress',   // overdue → start working on it
};
const STATUS_BTN     = {
  pending:     'Start Task',
  in_progress: 'Mark Completed',
  overdue:     'Start Task',
};

const EMPTY_FORM = {
  title: '', description: '', priority: 'medium',
  zone: '', dueDate: '', assignedTo: '', assignedToName: '',
};

export default function Tasks() {
  const { user } = useAuth();
  const { t }    = useLang();
  const isOwner   = user?.role === 'owner';
  const isOM      = user?.role === 'office_manager';
  const isAdmin   = user?.role === 'admin';
  const isLabor   = user?.role === 'labor';
  const canCreate = isOwner || isOM || isAdmin;
  const canDelete = isOwner || isAdmin;

  const [tasks, setTasks]         = useState([]);
  const [users, setUsers]         = useState([]);
  const [zones, setZones]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [toast, setToast]         = useState('');
  const [filter, setFilter]       = useState('all');
  const [showForm, setShowForm]   = useState(false);
  const [editTask, setEditTask]   = useState(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [reportModal, setReportModal] = useState(null); // task object
  const [reportText, setReportText]   = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2800); };

  const fetchAll = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await taskApi.getAll();
      setTasks(data);
      if (canCreate) {
        const [u, z] = await Promise.all([userApi.getAll(), zoneApi.getAll()]);
        setUsers(u.filter(x => x.role === 'labor'));
        setZones(z);
      }
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [canCreate]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = tasks.filter(t => {
    if (filter === 'all')         return true;
    if (filter === 'pending')     return t.status === 'pending';
    if (filter === 'in_progress') return t.status === 'in_progress';
    if (filter === 'completed')   return ['completed', 'reviewed'].includes(t.status);
    if (filter === 'overdue')     return t.status === 'overdue';
    if (filter === 'high')        return t.priority === 'high';
    return true;
  });

  // ── Create / Edit task ──────────────────────────────────────────────────────
  const openCreate = () => { setEditTask(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit   = (task) => {
    setEditTask(task);
    setForm({
      title: task.title, description: task.description || '',
      priority: task.priority, zone: task.zone || '',
      dueDate: task.dueDate ? task.dueDate.split('T')[0] : '',
      assignedTo: task.assignedTo || '', assignedToName: task.assignedToName || '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Title is required.'); return; }
    setSaving(true); setError('');
    try {
      const payload = { ...form, dueDate: form.dueDate || null, assignedTo: form.assignedTo || null };
      if (editTask) {
        await taskApi.update(editTask._id || editTask.id, payload);
        showToast('Task updated.');
      } else {
        await taskApi.create(payload);
        showToast('Task created.');
      }
      setShowForm(false); setEditTask(null); setForm(EMPTY_FORM);
      await fetchAll();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this task?')) return;
    try { await taskApi.remove(id); showToast('Task deleted.'); await fetchAll(); }
    catch (err) { setError(err.message); }
  };

  // ── Status advance (Laborer) ────────────────────────────────────────────────
  const handleAdvance = async (task) => {
    const next = STATUS_NEXT[task.status];
    if (!next) return;
    if (next === 'completed') { setReportModal(task); setReportText(''); return; }
    setSaving(true);
    try { await taskApi.updateStatus(task._id || task.id, next); showToast('Status updated.'); await fetchAll(); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleSubmitReport = async () => {
    if (!reportModal) return;
    setSaving(true);
    try {
      await taskApi.updateStatus(reportModal._id || reportModal.id, 'completed', reportText);
      showToast('Task completed! Report submitted.'); setReportModal(null); setReportText('');
      await fetchAll();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const counts = {
    all:         tasks.length,
    pending:     tasks.filter(t => t.status === 'pending').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    completed:   tasks.filter(t => ['completed', 'reviewed'].includes(t.status)).length,
    overdue:     tasks.filter(t => t.status === 'overdue').length,
    high:        tasks.filter(t => t.priority === 'high').length,
  };

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header">
        <h1><i className="fi fi-rr-clipboard-list" style={{ marginRight: 8 }} />
          {isLabor ? 'My Tasks' : 'Task Management'}
        </h1>
        <div className="header-actions">
          {canCreate && (
            <button className="btn btn-primary btn-sm" onClick={openCreate}>
              <i className="fi fi-rr-plus" style={{ marginRight: 4 }} />New Task
            </button>
          )}
          <button className="btn btn-outline btn-sm" onClick={fetchAll} disabled={loading}>
            <i className="fi fi-rr-refresh" style={{ marginRight: 4 }} />Refresh
          </button>
        </div>
      </div>

      {toast && <div className="alert alert-success"><i className="fi fi-rr-check" style={{ marginRight: 6 }} />{toast}</div>}
      {error && <div className="alert alert-error"><i className="fi fi-rr-triangle-warning" style={{ marginRight: 6 }} />{error}</div>}

      {/* ── Filter tabs ── */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {[
          { key: 'all',         label: `${t('all')} (${counts.all})` },
          { key: 'pending',     label: `${t('pending')} (${counts.pending})` },
          { key: 'in_progress', label: `${t('inProgress')} (${counts.in_progress})` },
          { key: 'completed',   label: `${t('completed')} (${counts.completed})` },
          { key: 'overdue',     label: `${t('overdue')} (${counts.overdue})`, danger: true },
          { key: 'high',        label: `${t('high')} ${t('priority')} (${counts.high})` },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`btn btn-sm ${filter === f.key ? (f.danger ? 'btn-danger' : 'btn-primary') : 'btn-outline'}`}
            style={f.danger && counts.overdue > 0 && filter !== f.key ? { borderColor: '#ef4444', color: '#ef4444' } : {}}>
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Create / Edit form ── */}
      {showForm && canCreate && (
        <div className="card" style={{ marginBottom: '1rem', borderLeft: '4px solid var(--primary)' }}>
          <div className="card-header">
            <span className="card-title"><i className="fi fi-rr-edit" style={{ marginRight: 6 }} />{editTask ? 'Edit Task' : 'New Task'}</span>
            <button className="btn btn-outline btn-sm" onClick={() => { setShowForm(false); setEditTask(null); }}>✕ Cancel</button>
          </div>
          <div className="form-row">
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Title *</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Inspect pump valves in Zone 3" maxLength={120} />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Description</label>
              <textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Optional task details…" maxLength={500} style={{ resize: 'vertical', width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)' }} />
            </div>
            <div className="form-group">
              <label>Priority</label>
              <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                <option value="low">🟢 Low</option>
                <option value="medium">🟡 Medium</option>
                <option value="high">🔴 High</option>
              </select>
            </div>
            <div className="form-group">
              <label>Farm</label>
              <select value={form.zone} onChange={e => setForm({ ...form, zone: e.target.value })}>
                <option value="">— Select farm —</option>
                {zones.map(z => <option key={z.id || z._id} value={z.name}>{z.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Due Date</label>
              <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} min={new Date().toISOString().split('T')[0]} />
            </div>
            <div className="form-group">
              <label>Assign To (Laborer)</label>
              <select value={form.assignedTo} onChange={e => {
                const u = users.find(x => x._id === e.target.value || x.id === e.target.value);
                setForm({ ...form, assignedTo: e.target.value, assignedToName: u?.name || '' });
              }}>
                <option value="">— Unassigned —</option>
                {users.map(u => <option key={u._id || u.id} value={u._id || u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? '⏳ Saving…' : <><i className="fi fi-rr-check" style={{ marginRight: 4 }} />{editTask ? 'Save Changes' : 'Create Task'}</>}
            </button>
            <button className="btn btn-outline" onClick={() => { setShowForm(false); setEditTask(null); }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ height: 90, background: '#e5e7eb', borderRadius: 10, animation: 'pulse 1.5s infinite' }}>
              <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && filtered.length === 0 && !error && (
        <div className="chart-box">
          <span className="ch-icon"><i className="fi fi-rr-clipboard-list" /></span>
          <span>{filter === 'all' ? 'No tasks yet.' : `No ${filter.replace('_', ' ')} tasks.`}</span>
        </div>
      )}

      {/* ── Task cards ── */}
      {!loading && filtered.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filtered.map(task => {
            return (
              <div key={task._id || task.id} style={{
                background: '#fff', borderRadius: 12, padding: '1rem 1.2rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                borderLeft: `4px solid ${task.status === 'overdue' ? '#ef4444' : PRIORITY_COLOR[task.priority] || '#e5e7eb'}`,
                border: `1px solid ${task.status === 'completed' || task.status === 'reviewed' ? '#bbf7d0' : task.status === 'overdue' ? '#fca5a5' : 'var(--border)'}`,
                opacity: task.status === 'completed' || task.status === 'reviewed' ? 0.8 : 1,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Title + status badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.97rem' }}>{task.title}</span>
                      <span style={{
                        fontSize: '0.7rem',
                        background: (STATUS_COLOR[task.status] || '#6b7280') + '22',
                        color: STATUS_COLOR[task.status] || '#6b7280',
                        border: `1px solid ${(STATUS_COLOR[task.status] || '#6b7280')}44`,
                        borderRadius: 20, padding: '2px 10px', fontWeight: 700, whiteSpace: 'nowrap',
                        animation: task.status === 'overdue' ? 'pulse 1.5s infinite' : 'none',
                      }}>
                        {STATUS_LABEL[task.status] || task.status?.replace('_',' ')}
                      </span>
                      <span style={{ fontSize: '0.7rem', background: PRIORITY_BG[task.priority], color: PRIORITY_COLOR[task.priority], border: `1px solid ${PRIORITY_COLOR[task.priority]}44`, borderRadius: 20, padding: '2px 10px', fontWeight: 600, whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
                        {task.priority} priority
                      </span>
                    </div>
                    {task.description && (
                      <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', margin: '0 0 6px', lineHeight: 1.5 }}>{task.description}</p>
                    )}
                    {/* Meta row */}
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      {task.zone           && <span><i className="fi fi-rr-map-marker" style={{ marginRight: 3 }} />{task.zone}</span>}
                      {task.assignedToName && <span><i className="fi fi-rr-user" style={{ marginRight: 3 }} />{task.assignedToName}</span>}
                      {task.assignedByName && <span><i className="fi fi-rr-user-gear" style={{ marginRight: 3 }} />{t('assignedBy')} {task.assignedByName}</span>}
                      {task.dueDate && (
                        <span style={{ color: task.status === 'overdue' ? '#ef4444' : 'inherit', fontWeight: task.status === 'overdue' ? 700 : 400 }}>
                          <i className={`fi ${task.status === 'overdue' ? 'fi-rr-clock' : 'fi-rr-calendar'}`} style={{ marginRight: 3 }} />
                          {task.status === 'overdue' ? `${t('overdue')}: ` : `${t('dueDate')}: `}
                          {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                      )}
                      {task.completedAt && <span style={{ color: '#16a34a' }}><i className="fi fi-rr-check-circle" style={{ marginRight: 3 }} />{t('completed')} {new Date(task.completedAt).toLocaleDateString()}</span>}
                    </div>
                    {task.report && (
                      <div style={{ marginTop: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '6px 10px', fontSize: '0.8rem', color: '#166534' }}>
                        <i className="fi fi-rr-document" style={{ marginRight: 4 }} /><b>Work Report:</b> {task.report}
                      </div>
                    )}
                  </div>
                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    {isLabor && !['completed','reviewed','unable_to_complete'].includes(task.status) && STATUS_NEXT[task.status] && (
                      <button onClick={() => handleAdvance(task)} disabled={saving}
                        className="btn btn-primary btn-sm">
                        <i className={`fi ${STATUS_NEXT[task.status] === 'completed' ? 'fi-rr-check-circle' : 'fi-rr-play'}`} style={{ marginRight: 4 }} />
                        {STATUS_BTN[task.status]}
                      </button>
                    )}
                    {canCreate && !isLabor && (
                      <button onClick={() => openEdit(task)} className="btn btn-outline btn-sm">
                        <i className="fi fi-rr-edit" />
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => handleDelete(task._id || task.id)} className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }}>
                        <i className="fi fi-rr-trash" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Work Report modal (laborer completing a task) ── */}
      {reportModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '1.5rem', width: '100%', maxWidth: 480, boxShadow: '0 8px 40px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 6 }}>
              <i className="fi fi-rr-document" style={{ marginRight: 8 }} />Submit Work Report
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Describe the work completed for: <b>{reportModal.title}</b>
            </p>
            <div className="form-group">
              <label>Work Report *</label>
              <textarea
                rows={4}
                value={reportText}
                onChange={e => setReportText(e.target.value)}
                placeholder="Describe what was done, any issues found, materials used…"
                maxLength={1000}
                style={{ resize: 'vertical', width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.88rem' }}
              />
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'right' }}>{reportText.length}/1000</div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
              <button className="btn btn-outline" onClick={() => setReportModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmitReport} disabled={saving || !reportText.trim()}>
                {saving ? '⏳ Submitting…' : <><i className="fi fi-rr-check-circle" style={{ marginRight: 4 }} />Complete & Submit</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
