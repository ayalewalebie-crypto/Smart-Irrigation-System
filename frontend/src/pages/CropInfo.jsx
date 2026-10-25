import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { zoneApi, historyApi } from '../services/api';

const CROP_STAGES = ['Seedling','Vegetative','Flowering','Fruiting','Harvest','Dormant'];
const HEALTH_OPTIONS = ['Excellent','Good','Fair','Poor','Critical'];
const HEALTH_COLOR   = { Excellent: '#22c55e', Good: '#84cc16', Fair: '#f59e0b', Poor: '#ef4444', Critical: '#7f1d1d' };

const EMPTY_CROP = { name: '', cropType: '', stage: 'Vegetative', health: 'Good', plantedDate: '', expectedHarvest: '', area: '', notes: '', irrigationNeeded: false };

export default function CropInfo() {
  const { user } = useAuth();

  const [farms, setFarms]           = useState([]);
  const [crops, setCrops]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [toast, setToast]           = useState('');
  const [showForm, setShowForm]     = useState(false);
  const [editId, setEditId]         = useState(null);
  const [form, setForm]             = useState(EMPTY_CROP);
  const [showReport, setShowReport] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reportFarm, setReportFarm] = useState('');
  const [reportSent, setReportSent] = useState(false);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2800); };

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await zoneApi.getAll();
      setFarms(data);
      // Build crop records from farms
      const built = data.map((f, i) => ({
        id:               f.id || f._id || i,
        farmId:           f.id || f._id,
        name:             f.name,
        cropType:         f.crop || 'Unknown',
        stage:            'Vegetative',
        health:           'Good',
        plantedDate:      '',
        expectedHarvest:  '',
        area:             f.area ? `${f.area} ha` : '—',
        notes:            '',
        irrigationNeeded: f.active === false && f.moisture < 30,
        moisture:         f.moisture ?? 0,
        active:           f.active,
      }));
      setCrops(built);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEdit = (c) => {
    setEditId(c.id);
    setForm({ name: c.name, cropType: c.cropType, stage: c.stage, health: c.health, plantedDate: c.plantedDate, expectedHarvest: c.expectedHarvest, area: c.area, notes: c.notes, irrigationNeeded: c.irrigationNeeded });
    setShowForm(true);
  };

  const handleSave = () => {
    setCrops(prev => prev.map(c => c.id === editId ? { ...c, ...form } : c));
    showToast('Crop information updated.');
    setShowForm(false); setEditId(null);
  };

  const requestIrrigation = async (crop) => {
    setCrops(prev => prev.map(c => c.id === crop.id ? { ...c, irrigationNeeded: true } : c));
    try {
      await historyApi.getAll({ limit: 1 }); // just ping to confirm connectivity
    } catch (_) {}
    showToast(`Irrigation requested for ${crop.name}.`);
  };

  const submitReport = async () => {
    if (!reportText.trim()) return;
    setReportSent(true);
    showToast('Problem report submitted.');
    setTimeout(() => { setShowReport(false); setReportSent(false); setReportText(''); setReportFarm(''); }, 2500);
  };

  return (
    <div>
      <div className="page-header">
        <h1><i className="fi fi-rr-leaf" style={{ marginRight: 8 }} />Crop Information</h1>
        <p>View assigned farms and crop status — monitor health, growth stage, irrigation needs and report problems.</p>
        <div className="header-actions">
          <button className="btn btn-outline btn-sm" style={{ borderColor: '#f59e0b', color: '#d97706' }} onClick={() => setShowReport(true)}>
            <i className="fi fi-rr-flag" style={{ marginRight: 4 }} />Report Problem
          </button>
          <button className="btn btn-outline btn-sm" onClick={load}><i className="fi fi-rr-refresh" /></button>
        </div>
      </div>

      {toast && <div className="alert alert-success"><i className="fi fi-rr-check" style={{ marginRight: 6 }} />{toast}</div>}
      {error && <div className="alert alert-error"><i className="fi fi-rr-triangle-warning" style={{ marginRight: 6 }} />{error}</div>}

      {/* Report problem modal */}
      {showReport && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '1.5rem', width: '100%', maxWidth: 480, boxShadow: '0 8px 40px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 6 }}>
              <i className="fi fi-rr-flag" style={{ marginRight: 8, color: '#f59e0b' }} />Report Farm / Crop Problem
            </h2>
            {reportSent ? (
              <div className="alert alert-success"><i className="fi fi-rr-check" style={{ marginRight: 6 }} />Report submitted!</div>
            ) : (
              <>
                <div className="form-group">
                  <label>Farm</label>
                  <select value={reportFarm} onChange={e => setReportFarm(e.target.value)}>
                    <option value="">— Select farm —</option>
                    {farms.map(f => <option key={f.id || f._id} value={f.name}>{f.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Problem Description *</label>
                  <textarea rows={4} value={reportText} onChange={e => setReportText(e.target.value)}
                    placeholder="Describe the crop or farm problem in detail…" maxLength={500}
                    style={{ resize: 'vertical', width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.88rem' }} />
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'right' }}>{reportText.length}/500</div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button className="btn btn-outline" onClick={() => setShowReport(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={submitReport} disabled={!reportText.trim()}>
                    <i className="fi fi-rr-paper-plane" style={{ marginRight: 4 }} />Submit Report
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Edit form */}
      {showForm && (
        <div className="card" style={{ marginBottom: '1rem', borderLeft: '4px solid #22c55e' }}>
          <div className="card-header">
            <span className="card-title"><i className="fi fi-rr-edit" style={{ marginRight: 6 }} />Update Crop Info — {form.name}</span>
            <button className="btn btn-outline btn-sm" onClick={() => setShowForm(false)}>✕</button>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Crop Type</label><input value={form.cropType} onChange={e => setForm({ ...form, cropType: e.target.value })} placeholder="e.g. Tomato" /></div>
            <div className="form-group"><label>Growth Stage</label>
              <select value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value })}>
                {CROP_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Health Status</label>
              <select value={form.health} onChange={e => setForm({ ...form, health: e.target.value })}>
                {HEALTH_OPTIONS.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Planted Date</label><input type="date" value={form.plantedDate} onChange={e => setForm({ ...form, plantedDate: e.target.value })} /></div>
            <div className="form-group"><label>Expected Harvest</label><input type="date" value={form.expectedHarvest} onChange={e => setForm({ ...form, expectedHarvest: e.target.value })} /></div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Notes</label>
              <textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Observations, treatments applied, issues…" style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', resize: 'vertical' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-primary" onClick={handleSave}><i className="fi fi-rr-check" style={{ marginRight: 4 }} />Save Changes</button>
            <button className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>{[1,2,3].map(i => <div key={i} style={{ height: 64, background: '#e5e7eb', borderRadius: 10, animation: 'pulse 1.5s infinite' }}><style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style></div>)}</div>}

      {/* Empty */}
      {!loading && crops.length === 0 && (
        <div className="chart-box"><span className="ch-icon"><i className="fi fi-rr-leaf" /></span>No farms assigned yet.</div>
      )}

      {/* Crop cards */}
      {!loading && crops.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {crops.map(c => (
            <div key={c.id} style={{ background: '#fff', borderRadius: 12, padding: '1rem 1.2rem', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: `4px solid ${HEALTH_COLOR[c.health] || '#e5e7eb'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '1rem' }}>{c.name}</span>
                    <span style={{ fontSize: '0.75rem', background: '#f0fdf4', color: '#16a34a', border: '1px solid #86efac', borderRadius: 20, padding: '2px 10px', fontWeight: 600 }}>
                      <i className="fi fi-rr-leaf" style={{ marginRight: 3 }} />{c.cropType}
                    </span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, background: HEALTH_COLOR[c.health] + '18', color: HEALTH_COLOR[c.health], border: `1px solid ${HEALTH_COLOR[c.health]}44`, borderRadius: 20, padding: '2px 10px' }}>
                      {c.health}
                    </span>
                    {c.irrigationNeeded && (
                      <span style={{ fontSize: '0.72rem', background: '#fef9c3', color: '#a16207', border: '1px solid #fde68a', borderRadius: 20, padding: '2px 10px', fontWeight: 700, animation: 'pulse 1.5s infinite' }}>
                        <i className="fi fi-rr-tint" style={{ marginRight: 3 }} />Irrigation Needed
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '1.2rem', flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                    <span><i className="fi fi-rr-seedling" style={{ marginRight: 3 }} />Stage: <b>{c.stage}</b></span>
                    <span><i className="fi fi-rr-map-marker" style={{ marginRight: 3 }} />Area: <b>{c.area}</b></span>
                    <span><i className="fi fi-rr-tint" style={{ marginRight: 3 }} />Moisture: <b style={{ color: c.moisture < 30 ? '#ef4444' : 'inherit' }}>{c.moisture}%</b></span>
                    {c.plantedDate     && <span><i className="fi fi-rr-calendar" style={{ marginRight: 3 }} />Planted: <b>{c.plantedDate}</b></span>}
                    {c.expectedHarvest && <span><i className="fi fi-rr-star" style={{ marginRight: 3 }} />Harvest: <b>{c.expectedHarvest}</b></span>}
                  </div>
                  {c.notes && <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>{c.notes}</p>}

                  {/* Moisture bar */}
                  <div style={{ marginTop: 8 }}>
                    <div style={{ height: 6, borderRadius: 4, background: '#e5e7eb', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${c.moisture}%`, background: c.moisture < 30 ? '#ef4444' : '#22c55e', borderRadius: 4, transition: 'width 0.4s' }} />
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flexShrink: 0 }}>
                  {!c.active && !c.irrigationNeeded && (
                    <button className="btn btn-primary btn-sm" onClick={() => requestIrrigation(c)}>
                      <i className="fi fi-rr-tint" style={{ marginRight: 4 }} />Request Irrigation
                    </button>
                  )}
                  {c.irrigationNeeded && (
                    <span style={{ fontSize: '0.75rem', color: '#a16207', fontWeight: 600, textAlign: 'center' }}>
                      <i className="fi fi-rr-clock" style={{ marginRight: 3 }} />Pending…
                    </span>
                  )}
                  <button className="btn btn-outline btn-sm" onClick={() => openEdit(c)}>
                    <i className="fi fi-rr-edit" style={{ marginRight: 4 }} />Update
                  </button>
                  <button className="btn btn-outline btn-sm" style={{ borderColor: '#f59e0b', color: '#d97706' }} onClick={() => { setReportFarm(c.name); setShowReport(true); }}>
                    <i className="fi fi-rr-flag" style={{ marginRight: 4 }} />Report
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
