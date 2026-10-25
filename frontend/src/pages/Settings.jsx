import { useState, useEffect } from 'react';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { settingsApi, sensorApi } from '../services/api';
import { useNotifications } from '../hooks/useNotifications';

const DEFAULT_CFG = {
  timezone: 'Africa/Addis_Ababa',
  units: 'metric',
  emailAlerts: true,
  smsAlerts: false,
  moistureThreshold: 30,
  tempThreshold: 35,
  autoIrrigate: true,
};

// Remove stale SETTINGS_BANNER (was the old role subtext — now removed)
const TYPE_COLOR = { warning: '#f59e0b', danger: '#ef4444', info: '#3b82f6', success: '#22c55e' };
const TYPE_BG    = { warning: '#fef9c3', danger: '#fee2e2', info: '#dbeafe', success: '#dcfce7' };
const TYPE_ICON  = {
  warning: <i className="fi fi-rr-triangle-warning" />,
  danger:  <i className="fi fi-rr-hexagon-exclamation" />,
  info:    <i className="fi fi-rr-info" />,
  success: <i className="fi fi-rr-check" />,
};

export default function Settings() {
  const { t, lang, switchLang } = useLang();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const { notifications, unreadCount, markAllRead, refresh } = useNotifications();

  const [cfg, setCfg]         = useState(DEFAULT_CFG);
  const [sensors, setSensors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState('');
  const [error, setError]     = useState('');
  const [alertTab, setAlertTab] = useState('all');

  useEffect(() => {
    Promise.all([settingsApi.get(), sensorApi.getAll()])
      .then(([cfgData, sensorData]) => {
        setCfg({ ...DEFAULT_CFG, ...cfgData });
        setSensors(sensorData);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const set = (k) => (e) =>
    setCfg({ ...cfg, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      await settingsApi.save(cfg);
      setToast(t('saved'));
      setTimeout(() => setToast(''), 2500);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const filteredAlerts = alertTab === 'all'
    ? notifications
    : notifications.filter(n => n.type === alertTab);

  const onlineCount  = sensors.filter(s => s.online).length;
  const offlineCount = sensors.filter(s => !s.online).length;

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {[1,2,3].map(i => (
        <div key={i} style={{ height: 160, background: '#e5e7eb', borderRadius: 10, animation: 'pulse 1.5s infinite' }}>
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <h1><i className="fi fi-rr-settings" style={{ marginRight: 8 }} />{t('settingsTitle')}</h1>
      </div>

      {toast && <div className="alert alert-success"><i className="fi fi-rr-check" style={{ marginRight: 6 }} />{toast}</div>}
      {error && <div className="alert alert-error"><i className="fi fi-rr-triangle-warning" style={{ marginRight: 6 }} />{error}</div>}

      <div className="grid-2">
        {/* General */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><i className="fi fi-rr-globe" style={{ marginRight: 6 }} />{t('general')}</span>
          </div>
          <div className="form-group">
            <label><i className="fi fi-rr-language" style={{ marginRight: 6 }} />{t('languageSetting')}</label>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: 4 }}>
              <button onClick={() => switchLang('en')} className={`btn btn-sm ${lang === 'en' ? 'btn-primary' : 'btn-outline'}`}>EN English</button>
              <button onClick={() => switchLang('am')} className={`btn btn-sm ${lang === 'am' ? 'btn-primary' : 'btn-outline'}`}>አማ አማርኛ</button>
            </div>
          </div>
          <div className="form-group">
            <label><i className="fi fi-rr-clock" style={{ marginRight: 6 }} />{t('timezone')}</label>
            <select value={cfg.timezone} onChange={set('timezone')}>
              <option value="Africa/Addis_Ababa">Africa/Addis Ababa (EAT +3)</option>
              <option value="UTC">UTC</option>
              <option value="Europe/London">Europe/London</option>
              <option value="America/New_York">America/New York</option>
            </select>
          </div>
          <div className="form-group">
            <label><i className="fi fi-rr-ruler-combined" style={{ marginRight: 6 }} />{t('units')}</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {['metric', 'imperial'].map(u => (
                <button key={u} onClick={() => setCfg({ ...cfg, units: u })}
                  className={`btn btn-sm ${cfg.units === u ? 'btn-primary' : 'btn-outline'}`}
                  style={{ textTransform: 'capitalize' }}>
                  {t(u)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><i className="fi fi-rr-bell" style={{ marginRight: 6 }} />{t('notifications')}</span>
          </div>
          {[
            { label: t('emailAlerts'),  key: 'emailAlerts',  icon: 'fi fi-rr-envelope' },
            { label: t('smsAlerts'),    key: 'smsAlerts',    icon: 'fi fi-rr-mobile' },
            { label: t('autoMode'),     key: 'autoIrrigate', icon: 'fi fi-rr-rotate-right' },
          ].map(({ label, key, icon }) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className={`fi ${icon}`} />{label}
              </span>
              <label className="toggle-switch">
                <input type="checkbox" checked={!!cfg[key]} onChange={set(key)} />
                <span className="toggle-slider" />
              </label>
            </div>
          ))}
        </div>

        {/* Thresholds */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><i className="fi fi-rr-dashboard" style={{ marginRight: 6 }} />{t('thresholds')}</span>
          </div>
          <div className="form-group">
            <label><i className="fi fi-rr-tint" style={{ marginRight: 6 }} />{t('moistureThreshold')}</label>
            <input type="range" min="10" max="80" value={cfg.moistureThreshold} onChange={set('moistureThreshold')} style={{ width: '100%', accentColor: 'var(--primary)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span>10%</span>
              <strong style={{ color: 'var(--primary)' }}>{cfg.moistureThreshold}%</strong>
              <span>80%</span>
            </div>
          </div>
          <div className="form-group">
            <label><i className="fi fi-rr-temperature-high" style={{ marginRight: 6 }} />{t('tempThreshold')}</label>
            <input type="range" min="20" max="45" value={cfg.tempThreshold} onChange={set('tempThreshold')} style={{ width: '100%', accentColor: 'var(--danger)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span>20°C</span>
              <strong style={{ color: 'var(--danger)' }}>{cfg.tempThreshold}°C</strong>
              <span>45°C</span>
            </div>
          </div>
        </div>

        {/* Device status */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><i className="fi fi-rr-signal-alt" style={{ marginRight: 6 }} />Device Status</span>
            <button className="btn btn-outline btn-sm" onClick={() => sensorApi.getAll().then(setSensors)}>
              <i className="fi fi-rr-refresh" />
            </button>
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem' }}>
            <div style={{ flex: 1, background: '#dcfce7', borderRadius: 8, padding: '0.6rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#166534' }}>{onlineCount}</div>
              <div style={{ fontSize: '0.72rem', color: '#166534' }}>Online</div>
            </div>
            <div style={{ flex: 1, background: '#fee2e2', borderRadius: 8, padding: '0.6rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#991b1b' }}>{offlineCount}</div>
              <div style={{ fontSize: '0.72rem', color: '#991b1b' }}>Offline</div>
            </div>
            <div style={{ flex: 1, background: '#dbeafe', borderRadius: 8, padding: '0.6rem', textAlign: 'center' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1e40af' }}>{sensors.length}</div>
              <div style={{ fontSize: '0.72rem', color: '#1e40af' }}>Total</div>
            </div>
          </div>
          {sensors.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: 180, overflowY: 'auto' }}>
              {sensors.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.5rem', borderRadius: 8, background: s.online ? '#f0fdf4' : '#fef2f2', fontSize: '0.83rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.online ? '#22c55e' : '#ef4444', flexShrink: 0 }} />
                    <span style={{ fontWeight: 600 }}>{s.id}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{s.type}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {s.zone && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{s.zone}</span>}
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: s.online ? '#166534' : '#991b1b' }}>
                      {s.online ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.75rem 0' }}>
              No devices registered yet.
            </p>
          )}
        </div>
      </div>

      {/* Alerts panel */}
      <div className="card" style={{ marginTop: '1.2rem' }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="card-title"><i className="fi fi-rr-bell-ring" style={{ marginRight: 6 }} />Device Alerts &amp; Failures</span>
            {unreadCount > 0 && (
              <span style={{ background: '#ef4444', color: '#fff', borderRadius: 20, padding: '2px 9px', fontSize: '0.72rem', fontWeight: 700 }}>
                {unreadCount} new
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={refresh}><i className="fi fi-rr-refresh" style={{ marginRight: 4 }} />Refresh</button>
            {unreadCount > 0 && (
              <button className="btn btn-secondary btn-sm" onClick={markAllRead}><i className="fi fi-rr-check" style={{ marginRight: 4 }} />Mark all read</button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {['all', 'danger', 'warning', 'info', 'success'].map(tab => (
            <button key={tab} onClick={() => setAlertTab(tab)}
              className={`btn btn-sm ${alertTab === tab ? 'btn-primary' : 'btn-outline'}`}
              style={{ textTransform: 'capitalize' }}>
              {tab === 'all' ? `All (${notifications.length})` : `${tab} (${notifications.filter(n => n.type === tab).length})`}
            </button>
          ))}
        </div>

        {filteredAlerts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            <i className="fi fi-rr-check-circle" style={{ fontSize: '2.5rem', display: 'block', marginBottom: 8, color: '#22c55e' }} />
            {alertTab === 'all' ? 'No alerts — all devices operating normally.' : `No ${alertTab} alerts found.`}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {filteredAlerts.map((n, i) => (
              <div key={n.id || i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '0.75rem 1rem', borderRadius: 10, background: TYPE_BG[n.type] || '#f9fafb', border: `1px solid ${TYPE_COLOR[n.type] || '#e5e7eb'}33` }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: TYPE_COLOR[n.type] || '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0, color: '#fff' }}>
                  {TYPE_ICON[n.type]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{n.event}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{n.date} {n.time}</span>
                  </div>
                  <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', margin: '3px 0 0', lineHeight: 1.5 }}>{n.details}</p>
                  <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                    {n.zone && n.zone !== '—' && (
                      <span style={{ fontSize: '0.7rem', background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: 20 }}>
                        <i className="fi fi-rr-map-marker" style={{ marginRight: 3 }} />{n.zone}
                      </span>
                    )}
                    <span style={{ fontSize: '0.7rem', background: TYPE_COLOR[n.type] + '22', color: TYPE_COLOR[n.type], padding: '2px 8px', borderRadius: 20, fontWeight: 600, textTransform: 'capitalize' }}>
                      {n.type}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Admin system info */}
      {isAdmin && (
        <div className="card" style={{ marginTop: '1.2rem' }}>
          <div className="card-header">
            <span className="card-title"><i className="fi fi-rr-shield-check" style={{ marginRight: 6 }} />System (Admin)</span>
          </div>
          <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {[
              { label: 'API Base URL',     value: import.meta.env.VITE_API_URL || 'http://localhost:8000/api' },
              { label: 'Frontend Version', value: '1.0.0' },
              { label: 'Total Sensors',    value: sensors.length },
              { label: 'Online Sensors',   value: onlineCount },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                <code style={{ fontSize: '0.78rem' }}>{value}</code>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: '1.2rem' }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? <><i className="fi fi-rr-spinner" style={{ marginRight: 6 }} />Saving…</> : <><i className="fi fi-rr-disk" style={{ marginRight: 6 }} />{t('save')}</>}
        </button>
      </div>
    </div>
  );
}
