import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { taskApi, zoneApi, problemReportApi } from '../services/api';

const PRIORITY_COLOR = { high:'#ef4444', urgent:'#b91c1c', medium:'#f59e0b', low:'#22c55e' };
const STATUS_STYLE = {
  pending:             { bg:'#f3f4f6', color:'#374151', labelKey:'pending' },
  in_progress:         { bg:'#dbeafe', color:'#1e40af', labelKey:'inProgress' },
  completed:           { bg:'#dcfce7', color:'#166534', labelKey:'completed' },
  unable_to_complete:  { bg:'#fee2e2', color:'#991b1b', labelKey:'unableToComplete' },
  overdue:             { bg:'#ffe4e6', color:'#be123c', labelKey:'overdue' },
};

const PROBLEM_TYPES_KEYS = [
  { value:'pump',                   labelKey:'pumpProblem' },
  { value:'pipe_leakage',           labelKey:'pipeLeakage' },
  { value:'low_water',              labelKey:'lowWater' },
  { value:'sensor',                 labelKey:'sensorProblem' },
  { value:'irrigation_not_working', labelKey:'irrigationNotWorking' },
  { value:'equipment',              labelKey:'equipmentIssue' },
  { value:'other',                  labelKey:'otherProblem' },
];

export default function IrrigationWork() {
  const navigate  = useNavigate();
  const { t }     = useLang();
  const [tasks,   setTasks]   = useState([]);
  const [zones,   setZones]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  // Problem report quick-form state
  const [showReport, setShowReport]     = useState(false);
  const [reportTask, setReportTask]     = useState(null);
  const [reportForm, setReportForm]     = useState({ problemType:'pump', description:'', priority:'medium', farm:'', field:'' });
  const [submitting, setSubmitting]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [allTasks, allZones] = await Promise.all([
        taskApi.getAll().catch(() => []),
        zoneApi.getAll().catch(() => []),
      ]);
      // Irrigation tasks = category is 'irrigation' or title/zone suggests irrigation
      const irrTasks = Array.isArray(allTasks)
        ? allTasks.filter(t => t.category === 'irrigation' || (t.zone && t.zone.length > 0))
        : [];
      setTasks(irrTasks);
      setZones(Array.isArray(allZones) ? allZones : []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleStatus = async (task, status) => {
    try {
      await taskApi.updateStatus(task._id || task.id, status);
      setActionMsg(`Task "${task.title}" → ${status.replace('_',' ')}`);
      setTimeout(() => setActionMsg(''), 3000);
      load();
    } catch (err) { setError(err.message); }
  };

  const openReport = (task) => {
    setReportTask(task);
    setReportForm({ problemType:'pump', description:'', priority:'medium', farm: task.zone || '', field:'' });
    setShowReport(true);
  };

  const submitReport = async (e) => {
    e.preventDefault();
    if (!reportForm.description.trim()) { setError('Description is required.'); return; }
    setSubmitting(true);
    try {
      await problemReportApi.create({ ...reportForm, taskId: reportTask?._id || reportTask?.id });
      setSuccess('Problem report submitted successfully.');
      setShowReport(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  if (loading) return (
    <div style={{ textAlign:'center', padding:'3rem', color:'var(--text-muted)' }}>
      <i className="fi fi-rr-spinner" style={{ fontSize:'2rem', display:'block', marginBottom:10 }} />Loading irrigation work...
    </div>
  );

  return (
    <div style={{ maxWidth:900, margin:'0 auto', paddingBottom:'2rem' }}>
      <div className="page-header">
        <h1><i className="fi fi-rr-water-ladder" style={{ marginRight:8, color:'#0891b2' }} />{t('irrigationWorkTitle')}</h1>
        <div className="header-actions">
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/problem-reports')} style={{ color:'#ef4444', borderColor:'#fca5a5' }}>
            <i className="fi fi-rr-triangle-warning" style={{ marginRight:4 }} />{t('reportProblem')}
          </button>
          <button className="btn btn-outline btn-sm" onClick={load}><i className="fi fi-rr-refresh" /></button>
        </div>
      </div>

      {error     && <div className="alert alert-error"   style={{ marginBottom:'0.75rem' }}><i className="fi fi-rr-triangle-warning" style={{ marginRight:6 }} />{error}</div>}
      {success   && <div className="alert alert-success" style={{ marginBottom:'0.75rem' }}><i className="fi fi-rr-check" style={{ marginRight:6 }} />{success}</div>}
      {actionMsg && <div className="alert alert-success" style={{ marginBottom:'0.75rem' }}><i className="fi fi-rr-check" style={{ marginRight:6 }} />{actionMsg}</div>}

      {/* Active Zones */}
      {zones.length > 0 && (
        <div className="card" style={{ marginBottom:'1rem' }}>
          <div className="card-header"><span className="card-title"><i className="fi fi-rr-seedling" style={{ marginRight:6 }} />Farm Zones Status</span></div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px,1fr))', gap:'0.5rem' }}>
            {zones.map(z => (
              <div key={z._id||z.id} style={{ padding:'0.65rem 0.9rem', borderRadius:8, background: z.active?'#f0fdf4':'#f9fafb', border:`1px solid ${z.active?'#86efac':'#e5e7eb'}`, display:'flex', alignItems:'center', gap:8 }}>
                <i className="fi fi-rr-seedling" style={{ color: z.active?'#16a34a':'#9ca3af', fontSize:'1.1rem' }} />
                <div>
                  <div style={{ fontWeight:600, fontSize:'0.82rem' }}>{z.name}</div>
                  <div style={{ fontSize:'0.7rem', color: z.active?'#16a34a':'#9ca3af' }}>{z.active?'Irrigating':'Idle'}</div>
                  {z.schedule && <div style={{ fontSize:'0.68rem', color:'#6b7280' }}>⏰ {z.schedule}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Irrigation Tasks */}
      <div className="card" style={{ padding:0 }}>
        <div className="card-header" style={{ padding:'0.75rem 1rem' }}>
          <span className="card-title"><i className="fi fi-rr-tint" style={{ marginRight:6 }} />{t('irrigationTasks')}</span>
          <span style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>{tasks.length} task{tasks.length!==1?'s':''}</span>
        </div>
        {tasks.length === 0 ? (
          <div style={{ padding:'2.5rem', textAlign:'center', color:'var(--text-muted)' }}>
            <i className="fi fi-rr-tint" style={{ fontSize:'2.5rem', display:'block', marginBottom:10, color:'#d1d5db' }} />
            <p style={{ margin:0 }}>{t('noTasksFound')}</p>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
            {tasks.map((task, i) => {
              const st = STATUS_STYLE[task.status] || STATUS_STYLE.pending;
              return (
                <div key={task._id||task.id} style={{ padding:'1rem', borderBottom: i<tasks.length-1?'1px solid var(--border)':'none', display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:10, justifyContent:'space-between', flexWrap:'wrap' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                        <div style={{ width:10, height:10, borderRadius:'50%', background: PRIORITY_COLOR[task.priority]||'#6b7280', flexShrink:0 }} />
                        <span style={{ fontWeight:700, fontSize:'0.95rem' }}>{task.title}</span>
                        <span style={{ background:st.bg, color:st.color, fontSize:'0.7rem', fontWeight:700, padding:'2px 9px', borderRadius:20 }}>{t(st.labelKey)}</span>
                      </div>
                      {task.zone && <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginTop:4 }}><i className="fi fi-rr-map-marker" style={{ marginRight:4 }} />{task.zone}</div>}
                      {task.description && <div style={{ fontSize:'0.82rem', color:'#374151', marginTop:4 }}>{task.description}</div>}
                      {task.instructions && (
                        <div style={{ marginTop:6, background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:8, padding:'6px 10px', fontSize:'0.8rem', color:'#1e40af' }}>
                          <strong>Instructions:</strong> {task.instructions}
                        </div>
                      )}
                      <div style={{ display:'flex', gap:12, marginTop:6, fontSize:'0.75rem', color:'var(--text-muted)', flexWrap:'wrap' }}>
                        {task.dueDate && <span><i className="fi fi-rr-calendar" style={{ marginRight:3 }} />Due: {new Date(task.dueDate).toLocaleDateString()}</span>}
                        {task.assignedByName && <span><i className="fi fi-rr-user" style={{ marginRight:3 }} />By: {task.assignedByName}</span>}
                      </div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:6, flexShrink:0 }}>
                      {task.status === 'pending' && (
                        <button className="btn btn-sm" style={{ background:'#eff6ff', color:'#2563eb', border:'1px solid #bfdbfe', borderRadius:6, padding:'4px 12px', fontSize:'0.78rem', fontWeight:600 }} onClick={() => handleStatus(task,'in_progress')}>
                          <i className="fi fi-rr-play" style={{ marginRight:4 }} />Start
                        </button>
                      )}
                      {task.status === 'in_progress' && (
                        <button className="btn btn-sm" style={{ background:'#f0fdf4', color:'#166534', border:'1px solid #86efac', borderRadius:6, padding:'4px 12px', fontSize:'0.78rem', fontWeight:600 }} onClick={() => handleStatus(task,'completed')}>
                          <i className="fi fi-rr-check" style={{ marginRight:4 }} />Complete
                        </button>
                      )}
                      {['pending','in_progress'].includes(task.status) && (
                        <button className="btn btn-sm" style={{ background:'#fff7ed', color:'#c2410c', border:'1px solid #fed7aa', borderRadius:6, padding:'4px 12px', fontSize:'0.78rem', fontWeight:600 }} onClick={() => openReport(task)}>
                          <i className="fi fi-rr-triangle-warning" style={{ marginRight:4 }} />Report
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Report Modal */}
      {showReport && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
          <div style={{ background:'#fff', borderRadius:16, maxWidth:480, width:'100%', padding:'1.5rem', maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem', borderBottom:'1px solid var(--border)', paddingBottom:10 }}>
              <h3 style={{ margin:0, display:'flex', alignItems:'center', gap:8 }}>
                <i className="fi fi-rr-triangle-warning" style={{ color:'#ef4444' }} />{t('reportProblem')}
              </h3>
              <button onClick={() => setShowReport(false)} style={{ background:'none', border:'none', fontSize:'1.2rem', cursor:'pointer', color:'var(--text-muted)' }}>✕</button>
            </div>
            {reportTask && <div style={{ background:'#f9fafb', borderRadius:8, padding:'8px 12px', marginBottom:'1rem', fontSize:'0.83rem', color:'var(--text-muted)' }}>Task: <strong style={{ color:'var(--text)' }}>{reportTask.title}</strong></div>}
            <form onSubmit={submitReport} style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div><label style={{ fontSize:'0.85rem', fontWeight:600, display:'block', marginBottom:4 }}>{t('problemType')} *</label>
                <select value={reportForm.problemType} onChange={e => setReportForm({...reportForm, problemType:e.target.value})} style={{ width:'100%', padding:'0.55rem 0.75rem', borderRadius:8, border:'1px solid var(--border)', fontSize:'0.88rem' }}>
                  {PROBLEM_TYPES_KEYS.map(p => <option key={p.value} value={p.value}>{t(p.labelKey)}</option>)}
                </select>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div><label style={{ fontSize:'0.85rem', fontWeight:600, display:'block', marginBottom:4 }}>Farm</label><input value={reportForm.farm} onChange={e => setReportForm({...reportForm, farm:e.target.value})} placeholder="Farm name" style={{ width:'100%', padding:'0.55rem 0.75rem', borderRadius:8, border:'1px solid var(--border)', fontSize:'0.88rem' }} /></div>
                <div><label style={{ fontSize:'0.85rem', fontWeight:600, display:'block', marginBottom:4 }}>Field/Zone</label><input value={reportForm.field} onChange={e => setReportForm({...reportForm, field:e.target.value})} placeholder="Field A" style={{ width:'100%', padding:'0.55rem 0.75rem', borderRadius:8, border:'1px solid var(--border)', fontSize:'0.88rem' }} /></div>
              </div>
              <div><label style={{ fontSize:'0.85rem', fontWeight:600, display:'block', marginBottom:4 }}>Priority</label>
                <select value={reportForm.priority} onChange={e => setReportForm({...reportForm, priority:e.target.value})} style={{ width:'100%', padding:'0.55rem 0.75rem', borderRadius:8, border:'1px solid var(--border)', fontSize:'0.88rem' }}>
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
                </select>
              </div>
              <div><label style={{ fontSize:'0.85rem', fontWeight:600, display:'block', marginBottom:4 }}>Description *</label>
                <textarea rows={3} required value={reportForm.description} onChange={e => setReportForm({...reportForm, description:e.target.value})} placeholder="Describe the problem clearly..." style={{ width:'100%', padding:'0.55rem 0.75rem', borderRadius:8, border:'1px solid var(--border)', fontSize:'0.88rem', resize:'vertical' }} />
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button type="button" className="btn btn-outline" style={{ flex:1 }} onClick={() => setShowReport(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex:1 }} disabled={submitting}>{submitting?'Submitting...':'Submit Report'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
