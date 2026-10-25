import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { zoneApi } from '../services/api';

const EMPTY_FARM = { name: '', crop: '', area: '', duration: 15, schedule: '06:00' };

export default function FarmControl() {
  const { user } = useAuth();
  const { t } = useLang();
  const canEdit   = user?.role === 'owner' || user?.role === 'admin';
  const canAdd    = user?.role === 'owner' || user?.role === 'admin';
  const canDelete = user?.role === 'owner' || user?.role === 'admin';
  const isLaborer = user?.role === 'labor';

  const [farms, setFarms]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [autoMode, setAutoMode] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newFarm, setNewFarm]   = useState(EMPTY_FARM);
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const fetchFarms = useCallback(async () => {
    setError('');
    try { const data = await zoneApi.getAll(); setFarms(data); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchFarms(); }, [fetchFarms]);

  const toggle = async (farm) => {
    if (!canEdit) return;
    const action = farm.active ? 'stop' : 'start';
    try {
      await zoneApi.control(farm.id, action);
      setFarms(prev => prev.map(f => f.id === farm.id ? { ...f, active: !f.active } : f));
    } catch (err) { setError(err.message); }
  };

  const controlAll = async (action) => {
    if (!canEdit) return;
    setSaving(true);
    try {
      await zoneApi.controlAll(action);
      setFarms(prev => prev.map(f => ({ ...f, active: action === 'start' })));
      showToast(action === 'start' ? t('active') : t('inactive'));
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const addFarm = async () => {
    if (!newFarm.name) return;
    setSaving(true);
    try {
      const created = await zoneApi.create({ ...newFarm, area: parseFloat(newFarm.area) || 1 });
      setFarms(prev => [...prev, created]);
      setNewFarm(EMPTY_FARM); setShowForm(false);
      showToast(t('saveChanges') + ' ✓');
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const deleteFarm = async (id) => {
    if (!window.confirm('Delete this farm?')) return;
    try { await zoneApi.remove(id); setFarms(prev => prev.filter(f => f.id !== id)); }
    catch (err) { setError(err.message); }
  };

  const deleteAllFarms = async () => {
    if (!window.confirm('Delete ALL farms? This cannot be undone.')) return;
    setSaving(true);
    try { await zoneApi.removeAll(); setFarms([]); showToast('All farms deleted.'); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const activeCount = farms.filter(f => f.active).length;

  return (
    <div>
      <div className="page-header">
        <h1><i className="fi fi-rr-seedling" style={{ marginRight: 8 }} />
          {isLaborer ? 'Assigned Farm' : t('farmControlTitle')}
        </h1>
        {canAdd && (
          <div className="header-actions">
            <button className="btn btn-outline btn-sm" onClick={() => setAutoMode(!autoMode)}>
              <i className={`fi ${autoMode ? 'fi-rr-rotate-right' : 'fi-rr-hand'}`} style={{ marginRight: 4 }} />
              {autoMode ? t('autoMode') : t('manualMode')}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => controlAll('start')} disabled={saving}>
              <i className="fi fi-rr-tint" style={{ marginRight: 4 }} />{t('irrigateAll')}
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => controlAll('stop')} disabled={saving}>
              <i className="fi fi-rr-stop" style={{ marginRight: 4 }} />{t('stopAll')}
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
              <i className="fi fi-rr-plus" style={{ marginRight: 4 }} />{t('addFarm')}
            </button>
            {canDelete && farms.length > 0 && (
              <button className="btn btn-danger btn-sm" onClick={deleteAllFarms} disabled={saving}>
                <i className="fi fi-rr-trash" style={{ marginRight: 4 }} />Delete All
              </button>
            )}
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="card" style={{ marginBottom: '1rem', display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('totalFarms')}</label>
          <div style={{ fontWeight: 700, fontSize: '1.4rem' }}>{farms.length}</div>
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('activeFarms')}</label>
          <div style={{ fontWeight: 700, fontSize: '1.4rem', color: 'var(--success)' }}>{activeCount}</div>
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mode</label>
          <div style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className={`fi ${autoMode ? 'fi-rr-rotate-right' : 'fi-rr-hand'}`} />
            {autoMode ? 'Auto' : 'Manual'}
          </div>
        </div>
        {toast && <div className="alert alert-success" style={{ margin: 0 }}><i className="fi fi-rr-check" style={{ marginRight: 6 }} />{toast}</div>}
        <button className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }} onClick={fetchFarms}>
          <i className="fi fi-rr-refresh" />
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          <i className="fi fi-rr-triangle-warning" style={{ marginRight: 6 }} />{error}&nbsp;
          <button className="btn btn-sm btn-outline" onClick={fetchFarms}>Retry</button>
        </div>
      )}

      {/* Add farm form */}
      {showForm && canAdd && (
        <div className="card" style={{ marginBottom: '1rem', borderLeft: '4px solid var(--primary)' }}>
          <div className="card-header">
            <span className="card-title"><i className="fi fi-rr-plus" style={{ marginRight: 6 }} />{t('addFarm')}</span>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Farm Name</label>
              <input value={newFarm.name} onChange={e => setNewFarm({ ...newFarm, name: e.target.value })} placeholder="e.g. South Garden Farm" />
            </div>
            <div className="form-group">
              <label>{t('cropType')}</label>
              <input value={newFarm.crop} onChange={e => setNewFarm({ ...newFarm, crop: e.target.value })} placeholder="e.g. Tomato" />
            </div>
            <div className="form-group">
              <label>{t('area')} (ha)</label>
              <input type="number" value={newFarm.area} onChange={e => setNewFarm({ ...newFarm, area: e.target.value })} placeholder="1.0" />
            </div>
            <div className="form-group">
              <label>{t('duration')} (min)</label>
              <input type="number" value={newFarm.duration} onChange={e => setNewFarm({ ...newFarm, duration: e.target.value })} />
            </div>
            <div className="form-group">
              <label>{t('schedule')}</label>
              <input type="time" value={newFarm.schedule} onChange={e => setNewFarm({ ...newFarm, schedule: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-primary" onClick={addFarm} disabled={saving}>
              {saving ? <i className="fi fi-rr-spinner" style={{ marginRight: 4 }} /> : <i className="fi fi-rr-check" style={{ marginRight: 4 }} />}
              {saving ? 'Saving…' : t('saveChanges')}
            </button>
            <button className="btn btn-outline" onClick={() => setShowForm(false)}>{t('cancel')}</button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="zones-grid">
          {[1,2,3].map(i => (
            <div key={i} className="zone-card" style={{ minHeight: 180, background: '#e5e7eb', animation: 'pulse 1.5s infinite' }}>
              <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
            </div>
          ))}
        </div>
      )}

      {/* No farms */}
      {!loading && farms.length === 0 && !error && (
        <div className="chart-box">
          <span className="ch-icon"><i className="fi fi-rr-seedling" /></span>
          <span>No farms configured yet. Add a farm to get started.</span>
        </div>
      )}

      {/* Farms grid */}
      {!loading && farms.length > 0 && (
        <div className="zones-grid">
          {farms.map(farm => (
            <div key={farm.id} className="zone-card" style={{ borderTop: `3px solid ${farm.active ? 'var(--success)' : 'var(--border)'}` }}>
              <div className="zone-header">
                <div>
                  <div className="zone-name">{farm.name}</div>
                  <div className="zone-crop">
                    <i className="fi fi-rr-leaf" style={{ marginRight: 4 }} />{farm.crop} · {farm.area} ha
                  </div>
                </div>
                {canEdit && (
                  <label className="toggle-switch" title={farm.active ? t('stop') : t('irrigate')}>
                    <input type="checkbox" checked={farm.active} onChange={() => toggle(farm)} />
                    <span className="toggle-slider" />
                  </label>
                )}
              </div>

              <div className="sensor-bar-wrap">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                  <span>{t('moisture')}</span>
                  <span>{farm.moisture != null ? `${farm.moisture}%` : '—'}</span>
                </div>
                <div className="sensor-bar">
                  <div className="sensor-bar-fill" style={{ width: `${farm.moisture ?? 0}%` }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.85rem', fontSize: '0.8rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                <span><i className="fi fi-rr-time-fast" style={{ marginRight: 3 }} />{farm.duration} min</span>
                <span><i className="fi fi-rr-clock" style={{ marginRight: 3 }} />{farm.schedule}</span>
                <span className={`badge ${farm.active ? 'badge-success' : 'badge-gray'}`}>
                  {farm.active ? t('active') : t('inactive')}
                </span>
              </div>

              {canEdit && (
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.85rem' }}>
                  <button className={`btn btn-sm ${farm.active ? 'btn-danger' : 'btn-primary'}`} style={{ flex: 1 }} onClick={() => toggle(farm)}>
                    <i className={`fi ${farm.active ? 'fi-rr-stop' : 'fi-rr-tint'}`} style={{ marginRight: 4 }} />
                    {farm.active ? t('stop') : t('irrigate')}
                  </button>
                  {canDelete && (
                    <button className="btn btn-outline btn-sm" onClick={() => deleteFarm(farm.id)} style={{ color: 'var(--danger)' }}>
                      <i className="fi fi-rr-trash" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
