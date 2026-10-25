/**
 * Notifications page — real alerts from sensor readings + system events
 * Available to all 4 roles; filters automatically to relevant events per role.
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { historyApi, sensorApi } from '../services/api';

const TYPE_COLOR = { warning: '#f59e0b', danger: '#ef4444', info: '#3b82f6', success: '#22c55e' };
const TYPE_BG    = { warning: '#fffbeb', danger: '#fef2f2', info:  '#eff6ff',  success: '#f0fdf4' };
const TYPE_ICON  = { warning: 'fi-rr-triangle-warning', danger: 'fi-rr-hexagon-exclamation', info: 'fi-rr-info', success: 'fi-rr-check-circle' };

const FILTER_TABS = [
  { key: 'all',     labelKey: 'all'      },
  { key: 'danger',  labelKey: 'alerts'   },
  { key: 'warning', labelKey: 'warnings' },
  { key: 'info',    labelKey: 'info'     },
  { key: 'success', labelKey: 'success'  },
];

export default function Notifications() {
  const { user } = useAuth();
  const { t }    = useLang();

  // Owner and Admin can permanently delete history records
  const canDelete = ['owner', 'admin'].includes(user?.role);
  // Only owner can clear ALL history
  const canClearAll = user?.role === 'owner';

  const [items,     setItems]     = useState([]);
  const [sensors,   setSensors]   = useState([]);
  const [filter,    setFilter]    = useState('all');
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sis_dismissed_notifs') || '[]'); }
    catch { return []; }
  });

  const [readIds, setReadIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('sis_read_notifs') || '[]')); }
    catch { return new Set(); }
  });

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [hist, sens] = await Promise.all([
        historyApi.getAll({ limit: 60 }),
        sensorApi.getAll().catch(() => []),
      ]);
      setItems(Array.isArray(hist) ? hist : hist?.events || []);
      setSensors(Array.isArray(sens) ? sens : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Generate sensor-based alerts from live readings
  const sensorAlerts = sensors.flatMap(s => {
    const alerts = [];
    const r = s.reading || {};
    if (r.moisture  !== undefined && r.moisture  < 30)  alerts.push({ id: `m-${s._id}`,   type: 'danger',  icon: 'fi-rr-leaf',             event: 'Low Soil Moisture',        details: `${s.name || s.deviceId}: ${r.moisture}% — irrigation may be needed`,    time: 'Live', zone: s.zone });
    if (r.moisture  !== undefined && r.moisture  > 80)  alerts.push({ id: `mh-${s._id}`,  type: 'warning', icon: 'fi-rr-leaf',             event: 'High Soil Moisture',       details: `${s.name || s.deviceId}: ${r.moisture}% — check for waterlogging`,       time: 'Live', zone: s.zone });
    if (r.temp      !== undefined && r.temp      > 38)  alerts.push({ id: `t-${s._id}`,   type: 'danger',  icon: 'fi-rr-temperature-high', event: 'High Temperature',         details: `${s.name || s.deviceId}: ${r.temp}°C — risk of crop stress`,            time: 'Live', zone: s.zone });
    if (r.waterLevel!== undefined && r.waterLevel < 20) alerts.push({ id: `wl-${s._id}`,  type: 'danger',  icon: 'fi-rr-tint',             event: 'Low Water Level',          details: `${s.name || s.deviceId}: ${r.waterLevel}% — refill tank`,              time: 'Live', zone: s.zone });
    if (r.ph        !== undefined && (r.ph < 5.5 || r.ph > 7.5)) alerts.push({ id: `ph-${s._id}`, type: 'warning', icon: 'fi-rr-flask', event: 'pH Out of Range', details: `${s.name || s.deviceId}: pH ${r.ph} — optimal range is 5.5–7.5`, time: 'Live', zone: s.zone });
    if (!s.online)                                       alerts.push({ id: `off-${s._id}`, type: 'warning', icon: 'fi-rr-signal-alt-slash', event: 'Device Offline',           details: `${s.name || s.deviceId} is not responding`,                            time: 'Live', zone: s.zone });
    return alerts;
  });

  // Merge sensor alerts + history events
  const histEvents = items.map(e => ({
    id:      e._id || e.id,
    type:    e.type || 'info',
    icon:    TYPE_ICON[e.type] || 'fi-rr-info',
    event:   e.event,
    details: e.details,
    zone:    e.zoneName,
    user:    e.userName,
    time:    e.recordedAt
               ? new Date(e.recordedAt).toLocaleString('en-ET', { dateStyle: 'short', timeStyle: 'short' })
               : e.time || '',
  }));

  const all = [...sensorAlerts, ...histEvents]
    .filter(n => !dismissed.includes(String(n.id)));

  const filtered = filter === 'all' ? all : all.filter(n => n.type === filter);

  const counts = FILTER_TABS.reduce((acc, t) => ({
    ...acc,
    [t.key]: t.key === 'all' ? all.length : all.filter(n => n.type === t.key).length,
  }), {});

  const dismiss = async (n) => {
    // If it's a real history record and user has permission → permanently delete
    if (canDelete && n.id && !String(n.id).startsWith('m-') && !String(n.id).startsWith('t-') &&
        !String(n.id).startsWith('wl-') && !String(n.id).startsWith('ph-') && !String(n.id).startsWith('off-') &&
        !String(n.id).startsWith('mh-')) {
      try {
        await historyApi.remove(n.id);
        setItems(prev => prev.filter(e => String(e._id || e.id) !== String(n.id)));
        return;
      } catch (_) {
        // fall through to local dismiss on error
      }
    }
    // Sensor alerts or no permission → local dismiss only
    const next = [...dismissed, String(n.id)];
    setDismissed(next);
    localStorage.setItem('sis_dismissed_notifs', JSON.stringify(next));
  };

  const clearAll = async () => {
    if (!window.confirm(canClearAll
      ? 'Delete ALL history records permanently? This cannot be undone.'
      : 'Clear all notifications from your view?')) return;

    if (canClearAll) {
      try {
        await historyApi.removeAll();
        setItems([]);
        setDismissed([]);
        setReadIds(new Set());
        localStorage.removeItem('sis_dismissed_notifs');
        localStorage.removeItem('sis_read_notifs');
        return;
      } catch (err) {
        setError(err.message);
        return;
      }
    }
    // Non-owner: just clear local view
    const allIds = all.map(n => String(n.id));
    setDismissed(allIds);
    localStorage.setItem('sis_dismissed_notifs', JSON.stringify(allIds));
  };

  // Mark all as read — items stay visible but lose the unread highlight
  const markAllRead = () => {
    const next = new Set(all.map(n => String(n.id)));
    setReadIds(next);
    localStorage.setItem('sis_read_notifs', JSON.stringify([...next]));
  };

  const isRead = (id) => readIds.has(String(id));

  const clearDismissed = () => {
    setDismissed([]);
    setReadIds(new Set());
    localStorage.removeItem('sis_dismissed_notifs');
    localStorage.removeItem('sis_read_notifs');
  };

  return (
    <div>
      <div className="page-header">
        <h1><i className="fi fi-rr-bell" style={{ marginRight: 8, color: 'var(--primary)' }} />{t('notificationsTitle')}</h1>
        <div className="header-actions">
          {all.length > 0 && (
            <button className="btn btn-outline btn-sm" onClick={markAllRead}>
              <i className="fi fi-rr-check-double" style={{ marginRight: 4 }} />{t('markAllRead')}
            </button>
          )}
          {/* Clear All — permanently deletes for owner, hides for others */}
          {all.length > 0 && (canClearAll || dismissed.length < all.length) && (
            <button className="btn btn-sm"
              onClick={clearAll}
              style={{
                background: canClearAll ? '#fee2e2' : '#f3f4f6',
                color:      canClearAll ? '#991b1b' : '#6b7280',
                border:     `1px solid ${canClearAll ? '#fca5a5' : '#d1d5db'}`,
                borderRadius: 7, padding: '4px 12px', fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
              }}>
              <i className={`fi ${canClearAll ? 'fi-rr-trash' : 'fi-rr-eye-crossed'}`} />
              {canClearAll ? t('delete') + ' ' + t('all') : t('clearAll')}
            </button>
          )}
          {/* Reset (restore dismissed) — only for non-delete users */}
          {!canDelete && (dismissed.length > 0 || readIds.size > 0) && (
            <button className="btn btn-outline btn-sm" onClick={clearDismissed}>
              <i className="fi fi-rr-refresh" style={{ marginRight: 4 }} />Reset
            </button>
          )}
          <button className="btn btn-outline btn-sm" onClick={load} disabled={loading}>
            <i className="fi fi-rr-refresh" style={{ marginRight: 4 }} />{t('refresh')}
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <i className="fi fi-rr-triangle-warning" style={{ marginRight: 6 }} />{error}
        </div>
      )}

      {/* Summary stat cards */}
      <div className="stats-grid" style={{ marginBottom: '1rem' }}>
        {[
          { label: t('totalLabel'), value: counts.all,     icon: 'fi-rr-bell',               color: '' },
          { label: t('alerts'),     value: counts.danger,  icon: 'fi-rr-hexagon-exclamation', color: 'danger' },
          { label: t('warnings'),   value: counts.warning, icon: 'fi-rr-triangle-warning',    color: '' },
          { label: t('info'),       value: counts.info,    icon: 'fi-rr-info',                color: 'info' },
          { label: t('success'),    value: counts.success, icon: 'fi-rr-check-circle',        color: 'success' },
        ].map(s => (
          <div key={s.label} className={`stat-card${s.color ? ' ' + s.color : ''}`}
            onClick={() => setFilter(s.label.toLowerCase())}
            style={{ cursor: 'pointer' }}>
            <span className="stat-icon"><i className={`fi ${s.icon}`} /></span>
            <div className="stat-info">
              <label>{s.label}</label>
              <strong>{s.value}</strong>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {FILTER_TABS.map(tab => (
          <button key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`btn btn-sm ${filter === tab.key ? 'btn-primary' : 'btn-outline'}`}>
            {t(tab.labelKey)}
            {counts[tab.key] > 0 && (
              <span style={{ marginLeft: 5, background: filter === tab.key ? 'rgba(255,255,255,0.3)' : '#e5e7eb', borderRadius: 20, padding: '0 6px', fontSize: '0.7rem', fontWeight: 700 }}>
                {counts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ height: 72, background: '#e5e7eb', borderRadius: 10, animation: 'pulse 1.5s infinite' }}>
              <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div className="chart-box" style={{ minHeight: 220 }}>
          <span className="ch-icon"><i className="fi fi-rr-check-circle" style={{ color: '#22c55e' }} /></span>
          <span style={{ fontWeight: 600 }}>
          {filter === 'all' ? t('noNotifications') : `${t('noRecords')} "${filter}".`}
          </span>
        </div>
      )}

      {/* Notification list */}
      {!loading && filtered.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {filtered.map((n, i) => {
            const color  = TYPE_COLOR[n.type] || '#6b7280';
            const bg     = TYPE_BG[n.type]    || '#f9fafb';
            const read   = isRead(n.id);
            return (
              <div key={n.id || i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                background: read ? '#f9fafb' : bg,
                border: `1px solid ${read ? '#e5e7eb' : color + '33'}`,
                borderLeft: `4px solid ${read ? '#d1d5db' : color}`,
                borderRadius: 10, padding: '0.8rem 1rem',
                opacity: read ? 0.6 : 1,
                transition: 'opacity 0.2s',
              }}>
                {/* Icon */}
                <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: `${read ? '#e5e7eb' : color + '18'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className={`fi ${n.icon || TYPE_ICON[n.type] || 'fi-rr-info'}`} style={{ color: read ? '#9ca3af' : color, fontSize: '1rem' }} />
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#111827' }}>{n.event}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '0.7rem', color: '#6b7280', whiteSpace: 'nowrap' }}>{n.time}</span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, background: `${color}22`, color, border: `1px solid ${color}44`, borderRadius: 20, padding: '1px 8px', textTransform: 'capitalize' }}>
                        {n.type}
                      </span>
                    </div>
                  </div>
                  {n.details && (
                    <p style={{ fontSize: '0.82rem', color: '#374151', margin: '3px 0 0', lineHeight: 1.5 }}>{n.details}</p>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
                    {n.zone && n.zone !== '—' && (
                      <span style={{ fontSize: '0.68rem', background: '#dbeafe', color: '#1e40af', padding: '1px 8px', borderRadius: 20 }}>
                        <i className="fi fi-rr-map-marker" style={{ marginRight: 3 }} />{n.zone}
                      </span>
                    )}
                    {n.user && (
                      <span style={{ fontSize: '0.68rem', background: '#f3f4f6', color: '#6b7280', padding: '1px 8px', borderRadius: 20 }}>
                        <i className="fi fi-rr-user" style={{ marginRight: 3 }} />{n.user}
                      </span>
                    )}
                  </div>
                </div>

                {/* Dismiss / Delete */}
                <button onClick={() => dismiss(n)} title={canDelete && !String(n.id).startsWith('m-') && !String(n.id).startsWith('t-') && !String(n.id).startsWith('wl-') && !String(n.id).startsWith('ph-') && !String(n.id).startsWith('off-') ? t('delete') : 'Dismiss'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4, flexShrink: 0, fontSize: '0.9rem', lineHeight: 1 }}
                  onMouseEnter={e => e.currentTarget.style.color = canDelete ? '#ef4444' : '#374151'}
                  onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}>
                  <i className={`fi ${canDelete && !String(n.id).startsWith('m-') && !String(n.id).startsWith('t-') && !String(n.id).startsWith('wl-') && !String(n.id).startsWith('ph-') && !String(n.id).startsWith('off-') ? 'fi-rr-trash' : 'fi-rr-cross-small'}`} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
