import { useState, useEffect, useCallback, useRef } from 'react';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { sensorApi, zoneApi } from '../services/api';
import socketService from '../services/socketService';

const DEVICE_TYPES = ['Arduino Uno', 'ESP8266', 'Soil Sensor', 'Temp/Humidity', 'Water Level', 'pH Sensor', 'Relay Module', 'Unknown'];

const EMPTY_DEVICE = { macAddress: '', name: '', type: 'ESP8266', zone: '' };

// ── pH colour helper ──────────────────────────────────────────────────────────
function phStatus(ph) {
  if (ph < 5.5)             return { color: '#ef4444', label: 'Acidic',  bg: '#fef2f2' };
  if (ph > 7.5)             return { color: '#f59e0b', label: 'Alkaline',bg: '#fffbeb' };
  return                           { color: '#22c55e', label: 'Normal',  bg: '#f0fdf4' };
}

// ── Water level colour helper ─────────────────────────────────────────────────
function waterLevelColor(pct) {
  if (pct < 20) return '#ef4444';
  if (pct < 50) return '#f59e0b';
  return '#22c55e';
}

export default function SensorInfo() {
  const { t } = useLang();
  const { user } = useAuth();
  const canControl = user?.role === 'owner' || user?.role === 'admin';
  const canManage  = user?.role === 'owner' || user?.role === 'admin';

  const [sensors, setSensors]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [filter, setFilter]             = useState('all');
  const [selected, setSelected]         = useState(null);
  const [lastRefresh, setLastRefresh]   = useState(null);
  const [socketLive, setSocketLive]     = useState(false); // true = real-time updates active
  const [alerts, setAlerts]             = useState([]);    // toast-style alert list
  const alertTimers                     = useRef({});      // auto-dismiss timers

  // LCD send state per device
  const [lcdDraft, setLcdDraft]   = useState({});
  const [lcdSending, setLcdSending] = useState({});
  const [lcdToast, setLcdToast]   = useState({});

  // Siren toggle state per device
  const [sirenLoading, setSirenLoading] = useState({});

  // Add Device form
  const [showAddForm, setShowAddForm] = useState(false);
  const [deviceForm,  setDeviceForm]  = useState(EMPTY_DEVICE);
  const [zones,       setZones]       = useState([]);
  const [addError,    setAddError]    = useState('');
  const [addSaving,   setAddSaving]   = useState(false);
  const [addSuccess,  setAddSuccess]  = useState('');

  const fetchSensors = useCallback(async () => {
    setError('');
    try {
      const data = await sensorApi.getAll();
      setSensors(data);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSensors(); }, [fetchSensors]);

  // ── Socket.IO real-time updates ─────────────────────────────────────────────
  useEffect(() => {
    // Connect and set up listeners
    socketService.connect();

    // sensor:update — merge incoming device data into state immediately
    const unsubUpdate = socketService.onSensorUpdate((data) => {
      setSocketLive(true);
      setLastRefresh(new Date());
      setSensors(prev => {
        const idx = prev.findIndex(s => s.id === data.id);
        if (idx === -1) {
          // New device appeared — append it
          return [...prev, data];
        }
        // Merge updated fields into the existing entry
        const updated = [...prev];
        updated[idx] = { ...updated[idx], ...data };
        return updated;
      });
    });

    // sensor:offline — mark device offline in state immediately
    const unsubOffline = socketService.onSensorOffline((data) => {
      setSensors(prev => prev.map(s =>
        s.id === data.id ? { ...s, online: false, lastSeen: data.lastSeen } : s
      ));
    });

    // device:connected — ESP8266 just connected/registered to backend
    const unsubDevConn = socketService.onDeviceConnected((data) => {
      setSocketLive(true);
      const id = `conn-${data.id}-${Date.now()}`;
      setAlerts(prev => [...prev, {
        id, deviceId: data.id, type: 'device_connected',
        message: `${data.id} connected (${data.type}${data.zone ? ' · ' + data.zone : ''})`,
      }]);
      alertTimers.current[id] = setTimeout(() => {
        setAlerts(prev => prev.filter(a => a.id !== id));
        delete alertTimers.current[id];
      }, 5000);
    });

    // device:disconnected — ESP8266 socket dropped
    const unsubDevDisc = socketService.onDeviceDisconnected((data) => {
      setSensors(prev => prev.map(s =>
        s.id === data.id ? { ...s, online: false } : s
      ));
      const id = `disc-${data.id}-${Date.now()}`;
      setAlerts(prev => [...prev, {
        id, deviceId: data.id, type: 'device_disconnected',
        message: `${data.id} disconnected from server`,
      }]);
      alertTimers.current[id] = setTimeout(() => {
        setAlerts(prev => prev.filter(a => a.id !== id));
        delete alertTimers.current[id];
      }, 6000);
    });

    // sensor:alert — show a dismissable toast notification
    const unsubAlert = socketService.onSensorAlert((data) => {
      const id = `${data.id}-${Date.now()}`;
      setAlerts(prev => [...prev, { id, deviceId: data.id, type: data.type, message: data.message }]);
      // Auto-dismiss after 8 seconds
      alertTimers.current[id] = setTimeout(() => {
        setAlerts(prev => prev.filter(a => a.id !== id));
        delete alertTimers.current[id];
      }, 8000);
    });

    // Fallback polling — every 30 s to catch any missed events
    // (much less frequent now that Socket.IO handles live data)
    const pollId = setInterval(fetchSensors, 30_000);

    return () => {
      unsubUpdate();
      unsubOffline();
      unsubAlert();
      unsubDevConn();
      unsubDevDisc();
      clearInterval(pollId);
      Object.values(alertTimers.current).forEach(clearTimeout);
      alertTimers.current = {};
    };
  }, [fetchSensors]);

  // Load zones when Add Device form opens
  useEffect(() => {
    if (showAddForm && zones.length === 0) {
      zoneApi.getAll().then(data => setZones(Array.isArray(data) ? data : [])).catch(() => {});
    }
  }, [showAddForm]);

  // ── Siren toggle ────────────────────────────────────────────────────────────
  const toggleSiren = async (s) => {
    if (!canControl) return;
    setSirenLoading(prev => ({ ...prev, [s.id]: true }));
    try {
      await sensorApi.sirenControl(s.id, s.sirenActive ? 'off' : 'on');
      await fetchSensors();
    } catch (err) {
      setError(err.message);
    } finally {
      setSirenLoading(prev => ({ ...prev, [s.id]: false }));
    }
  };

  // ── LCD send ────────────────────────────────────────────────────────────────
  const sendLcd = async (deviceId) => {
    const msg = (lcdDraft[deviceId] || '').trim();
    if (!msg) return;
    setLcdSending(prev => ({ ...prev, [deviceId]: true }));
    try {
      await sensorApi.sendLcd(deviceId, msg);
      setLcdDraft(prev => ({ ...prev, [deviceId]: '' }));
      setLcdToast(prev => ({ ...prev, [deviceId]: 'Sent!' }));
      setTimeout(() => setLcdToast(prev => ({ ...prev, [deviceId]: '' })), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLcdSending(prev => ({ ...prev, [deviceId]: false }));
    }
  };

  // ── Add Device ──────────────────────────────────────────────────────────────
  const handleAddDevice = async () => {
    setAddError('');
    const mac = deviceForm.macAddress.trim().toUpperCase();
    const macRegex = /^([0-9A-F]{2}[:\-]){5}[0-9A-F]{2}$/;
    if (!mac)          { setAddError('MAC address is required.'); return; }
    if (!macRegex.test(mac)) { setAddError('Invalid MAC format. Use XX:XX:XX:XX:XX:XX'); return; }
    if (!deviceForm.type)    { setAddError('Device type is required.'); return; }
    setAddSaving(true);
    try {
      const res = await sensorApi.create({
        macAddress: mac,
        name:       deviceForm.name.trim(),
        type:       deviceForm.type,
        zone:       deviceForm.zone,
      });
      setAddSuccess(`Device registered! ID: ${res.deviceId} · MAC: ${mac}`);
      setDeviceForm(EMPTY_DEVICE);
      setTimeout(() => { setShowAddForm(false); setAddSuccess(''); fetchSensors(); }, 2000);
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddSaving(false);
    }
  };

  const filtered     = sensors.filter((s) => {    if (filter === 'all')    return true;
    if (filter === 'online') return s.online;
    if (filter === 'offline')return !s.online;
    return s.type.toLowerCase().includes(filter);
  });

  const onlineCount  = sensors.filter(s => s.online).length;
  const offlineCount = sensors.filter(s => !s.online).length;

  const avgTemp = onlineCount > 0
    ? (sensors.filter(s => s.online).reduce((a, s) => a + s.temp, 0) / onlineCount).toFixed(1)
    : '—';
  const avgMoisture = onlineCount > 0
    ? Math.round(sensors.filter(s => s.online).reduce((a, s) => a + s.moisture, 0) / onlineCount)
    : '—';

  return (
    <div>
      <div className="page-header">
        <h1><i className="fi fi-rr-signal-alt" style={{ marginRight: 8 }} />{t('sensorsTitle')}</h1>
        <div className="header-actions">
          {/* Real-time connection badge */}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20,
            background: socketLive ? '#dcfce7' : '#f3f4f6',
            color:      socketLive ? '#166534' : '#6b7280',
            border:     `1px solid ${socketLive ? '#86efac' : '#d1d5db'}`,
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: socketLive ? '#22c55e' : '#9ca3af',
              display: 'inline-block',
              animation: socketLive ? 'pulse 1.5s infinite' : 'none',
            }} />
            {socketLive ? 'Live' : 'Polling'}
          </span>

          <button className="btn btn-secondary btn-sm" onClick={fetchSensors} disabled={loading}>
            <i className="fi fi-rr-refresh" style={{ marginRight: 4 }} />{t('refresh')}
          </button>
          {canManage && (
            <button className="btn btn-primary btn-sm" onClick={() => { setShowAddForm(true); setAddError(''); setAddSuccess(''); setDeviceForm(EMPTY_DEVICE); }}>
              <i className="fi fi-rr-plus" style={{ marginRight: 4 }} />{t('addDevice')}
            </button>
          )}
          {lastRefresh && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
              {t('lastSeen')}: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* ── Real-time alert toasts ──────────────────────────────────────── */}
      {alerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.8rem' }}>
          {alerts.map(a => {
            const isError   = a.type === 'high_temp' || a.type === 'siren_active';
            const isSuccess = a.type === 'device_connected';
            const isWarn    = a.type === 'device_disconnected';
            const bg     = isError ? '#fee2e2' : isSuccess ? '#dcfce7' : isWarn ? '#f3f4f6' : '#fffbeb';
            const color  = isError ? '#991b1b' : isSuccess ? '#166534' : isWarn ? '#374151' : '#92400e';
            const border = isError ? '#fca5a5' : isSuccess ? '#86efac' : isWarn ? '#d1d5db' : '#fcd34d';
            const icon   = isSuccess ? 'fi-rr-plug-connection'
                         : isWarn    ? 'fi-rr-plug-alt'
                         : a.type === 'siren_active' ? 'fi-rr-bell-ring'
                         : 'fi-rr-triangle-warning';
            return (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.55rem 0.9rem', borderRadius: 8, fontSize: '0.83rem', fontWeight: 600,
                background: bg, color, border: `1px solid ${border}`,
              }}>
                <span>
                  <i className={`fi ${icon}`} style={{ marginRight: 7 }} />
                  {a.message}
                </span>
                <button onClick={() => setAlerts(prev => prev.filter(x => x.id !== a.id))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: '0 4px', fontSize: '0.9rem' }}>
                  <i className="fi fi-rr-cross" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          <i className="fi fi-rr-triangle-warning" style={{ marginRight: 6 }} />{error}&nbsp;
          <button className="btn btn-sm btn-outline" onClick={fetchSensors}>Retry</button>
        </div>
      )}

      {/* ── Summary stats ────────────────────────────────────────────────── */}
      <div className="stats-grid" style={{ marginBottom: '1rem' }}>
        <div className="stat-card success">
          <span className="stat-icon"><i className="fi fi-rr-check-circle" /></span>
          <div className="stat-info"><label>{t('connected')}</label><strong>{onlineCount}</strong><span>nodes</span></div>
        </div>
        <div className="stat-card danger">
          <span className="stat-icon"><i className="fi fi-rr-circle-xmark" /></span>
          <div className="stat-info"><label>{t('disconnected')}</label><strong>{offlineCount}</strong><span>nodes</span></div>
        </div>
        <div className="stat-card info">
          <span className="stat-icon"><i className="fi fi-rr-temperature-high" /></span>
          <div className="stat-info"><label>Avg {t('temperature')}</label><strong>{avgTemp !== '—' ? `${avgTemp}°C` : '—'}</strong></div>
        </div>
        <div className="stat-card">
          <span className="stat-icon"><i className="fi fi-rr-tint" /></span>
          <div className="stat-info"><label>Avg {t('moisture')}</label><strong>{avgMoisture !== '—' ? `${avgMoisture}%` : '—'}</strong></div>
        </div>
      </div>

      {/* ── Filter tabs ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {['all', 'online', 'offline', 'arduino uno', 'esp8266'].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-outline'}`}
            style={{ textTransform: 'capitalize' }}>
            {f === 'all' ? t('all') : f}
          </button>
        ))}
      </div>

      {/* ── Loading skeleton ─────────────────────────────────────────────── */}
      {loading && (
        <div className="sensor-grid">
          {[1,2,3,4].map(i => (
            <div key={i} className="sensor-card" style={{ minHeight: 160, background: '#e5e7eb', animation: 'pulse 1.5s infinite' }}>
              <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
            </div>
          ))}
        </div>
      )}

      {/* ── No devices at all ────────────────────────────────────────────── */}
      {!loading && sensors.length === 0 && !error && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <i className="fi fi-rr-signal-alt-slash" style={{ fontSize: '3rem', color: '#d1d5db', display: 'block', marginBottom: '0.8rem' }} />
          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#374151', marginBottom: '0.4rem' }}>No devices registered yet</div>
          <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1.2rem' }}>
            Register your ESP8266 by its MAC address, then upload the Arduino code to start seeing live data.
          </div>
          {canManage && (
            <button className="btn btn-primary" onClick={() => { setShowAddForm(true); setAddError(''); setAddSuccess(''); setDeviceForm(EMPTY_DEVICE); }}>
              <i className="fi fi-rr-plus" style={{ marginRight: 6 }} />Register First Device
            </button>
          )}
        </div>
      )}

      {/* ── No results for current filter ────────────────────────────────── */}
      {!loading && sensors.length > 0 && filtered.length === 0 && !error && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <i className="fi fi-rr-search-alt" style={{ fontSize: '2rem', color: '#d1d5db', display: 'block', marginBottom: '0.5rem' }} />
          <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>
            No {filter === 'online' ? 'online' : filter === 'offline' ? 'offline' : filter} devices found.
          </div>
        </div>
      )}

      {/* ── Sensor cards ─────────────────────────────────────────────────── */}
      {!loading && filtered.length > 0 && (
        <div className="sensor-grid">
          {filtered.map((s) => {
            const ph       = phStatus(s.ph);
            const wlColor  = waterLevelColor(s.waterLevel);
            const isOpen   = selected === s.id;

            return (
              <div key={s.id} className="sensor-card"
                style={{
                  cursor: 'pointer',
                  outline: isOpen ? '2px solid var(--primary)' : 'none',
                  opacity: s.online ? 1 : 0.85,
                  borderTop: `3px solid ${s.online ? '#22c55e' : '#ef4444'}`,
                }}>

                {/* ── Card header — click to expand ── */}
                <div className="sensor-header" onClick={() => setSelected(isOpen ? null : s.id)}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      {/* Online / Offline pill */}
                      <span style={{
                        fontSize: '0.62rem', fontWeight: 800, padding: '2px 8px', borderRadius: 20,
                        background: s.online ? '#dcfce7' : '#fee2e2',
                        color:      s.online ? '#166534' : '#991b1b',
                        border:     `1px solid ${s.online ? '#86efac' : '#fca5a5'}`,
                        flexShrink: 0,
                      }}>
                        {s.online ? '● ONLINE' : '○ OFFLINE'}
                      </span>
                      {s.online && s.sirenActive && (
                        <span style={{ fontSize: '0.62rem', background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: 20, padding: '2px 8px', fontWeight: 700 }}>
                          🚨 SIREN
                        </span>
                      )}
                    </div>

                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.name || s.id}
                    </div>
                    <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 1, marginTop: 2 }}>
                      <span>{s.type}{s.zone ? ` · ${s.zone}` : ''}</span>
                      {s.mac && (
                        <span style={{ fontFamily: 'monospace', fontSize: '0.67rem', color: '#6b7280', letterSpacing: '0.04em' }}>
                          <i className="fi fi-rr-network" style={{ marginRight: 3 }} />{s.mac}
                        </span>
                      )}
                      <span style={{ fontFamily: 'monospace', fontSize: '0.65rem', color: '#9ca3af' }}>
                        ID: {s.id}
                      </span>
                    </div>
                  </div>

                  {/* Signal strength (online only) */}
                  {s.online && s.signalStrength !== 0 && (
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <i className="fi fi-rr-wifi" style={{
                        fontSize: '1.1rem',
                        color: s.signalStrength > -60 ? '#16a34a' : s.signalStrength > -75 ? '#f59e0b' : '#ef4444',
                      }} />
                      <div style={{ fontSize: '0.62rem', color: '#9ca3af', marginTop: 1 }}>{s.signalStrength} dBm</div>
                    </div>
                  )}
                </div>

                {s.online ? (
                  <>
                    {/* ── Main metrics grid ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <MetricBox icon="fi-rr-temperature-high" label={t('temperature')} value={`${s.temp}°C`}
                        alert={s.temp > 35} alertColor="#ef4444" />
                      <MetricBox icon="fi-rr-raindrops"        label={t('humidity')}    value={`${s.humidity}%`} />
                      <MetricBox icon="fi-rr-leaf"             label={t('moisture')}    value={`${s.moisture}%`}
                        alert={s.moisture < 30} alertColor="#f59e0b" />
                      <MetricBox icon="fi-rr-water"            label={t('waterFlow')}   value={`${s.flow} L/m`} />
                    </div>

                    {/* ── Moisture bar ── */}
                    <div className="sensor-bar-wrap" style={{ marginTop: '0.5rem' }}>
                      <div className="sensor-bar">
                        <div className="sensor-bar-fill" style={{ width: `${s.moisture}%` }} />
                      </div>
                      <div className="sensor-meta">
                        <span>{t('moisture')}</span>
                        <span>{s.moisture}%</span>
                      </div>
                    </div>

                    {/* ── Water level gauge ── */}
                    <div style={{ marginTop: '0.6rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 3 }}>
                        <span><i className="fi fi-rr-water" style={{ marginRight: 4 }} />Water Level</span>
                        <span style={{ fontWeight: 700, color: wlColor }}>{s.waterLevel}%
                          {s.waterLevel < 20 && <span style={{ marginLeft: 4, color: '#ef4444' }}>⚠ Low</span>}
                        </span>
                      </div>
                      <div style={{ height: 10, borderRadius: 5, background: '#e5e7eb', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${s.waterLevel}%`, background: wlColor, borderRadius: 5, transition: 'width 0.5s' }} />
                      </div>
                    </div>

                    {/* ── pH pill ── */}
                    <div style={{ marginTop: '0.55rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        <i className="fi fi-rr-flask" style={{ marginRight: 4 }} />pH
                      </span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, background: ph.bg, color: ph.color, borderRadius: 20, padding: '2px 10px', border: `1px solid ${ph.color}33` }}>
                        {s.ph} — {ph.label}
                      </span>
                    </div>

                    {/* ── LCD display ── */}
                    <div style={{ marginTop: '0.55rem', background: '#111', borderRadius: 6, padding: '6px 10px', border: '2px solid #333' }}>
                      <div style={{ fontSize: '0.6rem', color: '#4ade80', marginBottom: 2, letterSpacing: 1 }}>LCD DISPLAY</div>
                      <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#86efac', minHeight: 18, letterSpacing: 1 }}>
                        {s.lcdMessage || <span style={{ opacity: 0.4 }}>— no message —</span>}
                      </div>
                    </div>

                    {/* ── Expanded detail panel ── */}
                    {isOpen && (
                      <div style={{ marginTop: '0.75rem', background: 'var(--primary-light)', borderRadius: 8, padding: '0.8rem', fontSize: '0.8rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginBottom: '0.75rem' }}>
                          <span><i className="fi fi-rr-sun" style={{ marginRight: 4 }} />{t('light')}: <b>{s.light} lx</b></span>
                          <span><i className="fi fi-rr-wind" style={{ marginRight: 4 }} />{t('pressure')}: <b>{s.pressure} hPa</b></span>
                          <span><i className="fi fi-rr-clock" style={{ marginRight: 4 }} />{t('lastSeen')}: <b>{s.lastSeen ? new Date(s.lastSeen).toLocaleTimeString() : 'now'}</b></span>
                          <span><i className="fi fi-rr-sensor-on" style={{ marginRight: 4 }} />Type: <b>{s.type}</b></span>
                          {s.mac && <span style={{ gridColumn: '1/-1' }}><i className="fi fi-rr-network" style={{ marginRight: 4 }} />MAC: <b style={{ fontFamily: 'monospace' }}>{s.mac}</b></span>}
                          {s.firmwareVersion && <span><i className="fi fi-rr-code-branch" style={{ marginRight: 4 }} />FW: <b>{s.firmwareVersion}</b></span>}
                          {s.signalStrength !== 0 && <span><i className="fi fi-rr-wifi" style={{ marginRight: 4 }} />Signal: <b style={{ color: s.signalStrength > -60 ? '#16a34a' : s.signalStrength > -75 ? '#f59e0b' : '#ef4444' }}>{s.signalStrength} dBm</b></span>}
                        </div>

                        {canControl && (
                          <div style={{ marginBottom: '0.65rem' }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary-dark)', marginBottom: 5 }}>
                              <i className="fi fi-rr-bell-ring" style={{ marginRight: 4 }} />Siren Control
                            </div>
                            <button onClick={() => toggleSiren(s)} disabled={sirenLoading[s.id]}
                              style={{ padding: '6px 18px', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', border: 'none', background: s.sirenActive ? '#ef4444' : '#166534', color: '#fff', display: 'flex', alignItems: 'center', gap: 6, opacity: sirenLoading[s.id] ? 0.6 : 1 }}>
                              <i className={`fi ${s.sirenActive ? 'fi-rr-bell-slash' : 'fi-rr-bell-ring'}`} />
                              {sirenLoading[s.id] ? '...' : s.sirenActive ? 'Turn Siren OFF' : 'Turn Siren ON'}
                            </button>
                          </div>
                        )}

                        {canControl && (
                          <div>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary-dark)', marginBottom: 5 }}>
                              <i className="fi fi-rr-screen" style={{ marginRight: 4 }} />Send to LCD
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <input type="text" maxLength={64} placeholder="Type message (max 64 chars)…"
                                value={lcdDraft[s.id] || ''}
                                onChange={e => setLcdDraft(prev => ({ ...prev, [s.id]: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && sendLcd(s.id)}
                                style={{ flex: 1, fontSize: '0.78rem', padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', fontFamily: 'monospace' }} />
                              <button onClick={() => sendLcd(s.id)} disabled={lcdSending[s.id] || !lcdDraft[s.id]?.trim()}
                                style={{ padding: '5px 14px', borderRadius: 6, background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', opacity: (lcdSending[s.id] || !lcdDraft[s.id]?.trim()) ? 0.5 : 1 }}>
                                {lcdSending[s.id] ? '...' : <i className="fi fi-rr-paper-plane" />}
                              </button>
                            </div>
                            {lcdToast[s.id] && <span style={{ fontSize: '0.7rem', color: '#16a34a', marginTop: 3, display: 'block' }}>✓ {lcdToast[s.id]}</span>}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  /* ── OFFLINE state — show device info + last seen ── */
                  <div style={{ marginTop: '0.75rem' }}>
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '0.8rem 1rem', textAlign: 'center', marginBottom: '0.6rem' }}>
                      <i className="fi fi-rr-signal-alt-slash" style={{ fontSize: '1.6rem', color: '#ef4444', display: 'block', marginBottom: 5 }} />
                      <div style={{ fontWeight: 800, color: '#991b1b', fontSize: '0.85rem' }}>OFFLINE</div>
                      <div style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: 3 }}>Device not connected</div>
                    </div>

                    {/* Last known info */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem', fontSize: '0.75rem' }}>
                      {[
                        { icon: 'fi-rr-clock',       label: 'Last Seen',  value: s.lastSeen ? new Date(s.lastSeen).toLocaleString('en-ET', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never' },
                        { icon: 'fi-rr-sensor-on',    label: 'Type',       value: s.type || '—' },
                        { icon: 'fi-rr-seedling',     label: 'Zone',       value: s.zone || '—' },
                        { icon: 'fi-rr-thermometer',  label: 'Last Temp',  value: s.temp > 0 ? `${s.temp}°C` : '—' },
                        { icon: 'fi-rr-leaf',         label: 'Last Moist', value: s.moisture > 0 ? `${s.moisture}%` : '—' },
                        { icon: 'fi-rr-water',        label: 'Last Water', value: s.waterLevel > 0 ? `${s.waterLevel}%` : '—' },
                      ].map(({ icon, label, value }) => (
                        <div key={label} style={{ background: '#f9fafb', borderRadius: 6, padding: '0.35rem 0.5rem' }}>
                          <div style={{ color: '#9ca3af', fontSize: '0.65rem', marginBottom: 1 }}>
                            <i className={`fi ${icon}`} style={{ marginRight: 3 }} />{label}
                          </div>
                          <div style={{ fontWeight: 600, color: '#374151' }}>{value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Reconnect hint */}
                    <div style={{ marginTop: '0.6rem', fontSize: '0.7rem', color: '#9ca3af', textAlign: 'center', padding: '0.4rem', background: '#f9fafb', borderRadius: 6 }}>
                      <i className="fi fi-rr-info" style={{ marginRight: 4 }} />
                      Power on the device to reconnect automatically
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add Device Modal ─────────────────────────────────────────── */}
      {showAddForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '1.5rem', width: '100%', maxWidth: 440, boxShadow: '0 8px 40px rgba(0,0,0,0.2)' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1.05rem' }}>
                <i className="fi fi-rr-sensor-on" style={{ marginRight: 8, color: '#166534' }} />
                Register New Device
              </h3>
              <button onClick={() => setShowAddForm(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#6b7280' }}>
                <i className="fi fi-rr-cross" />
              </button>
            </div>

            {/* How to find MAC hint */}
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '0.55rem 0.8rem', marginBottom: '1rem', fontSize: '0.78rem', color: '#1e40af' }}>
              <i className="fi fi-rr-info" style={{ marginRight: 6 }} />
              <strong>How to find MAC:</strong> Open Arduino Serial Monitor at 115200 baud and power on the ESP8266. The MAC address prints on startup.
            </div>

            {/* Alerts */}
            {addError   && <div className="alert alert-error"   style={{ marginBottom: '0.8rem' }}><i className="fi fi-rr-triangle-warning" style={{ marginRight: 6 }} />{addError}</div>}
            {addSuccess && <div className="alert alert-success" style={{ marginBottom: '0.8rem' }}><i className="fi fi-rr-check" style={{ marginRight: 6 }} />{addSuccess}</div>}

            {/* Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

              <div className="form-group">
                <label>MAC Address <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  value={deviceForm.macAddress}
                  onChange={e => setDeviceForm(f => ({ ...f, macAddress: e.target.value }))}
                  placeholder="e.g. A4:CF:12:B5:E3:01"
                  style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'monospace' }}
                  maxLength={17}
                />
                <span style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: 3, display: 'block' }}>
                  Found on ESP8266: Serial Monitor prints MAC on startup. Format: XX:XX:XX:XX:XX:XX
                </span>
              </div>

              <div className="form-group">
                <label>Device Name</label>
                <input
                  value={deviceForm.name}
                  onChange={e => setDeviceForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Zone A Moisture Sensor"
                  maxLength={60}
                />
              </div>

              <div className="form-group">
                <label>Device Type <span style={{ color: '#ef4444' }}>*</span></label>
                <select value={deviceForm.type} onChange={e => setDeviceForm(f => ({ ...f, type: e.target.value }))}>
                  {DEVICE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Assign to Farm Zone</label>
                <select value={deviceForm.zone} onChange={e => setDeviceForm(f => ({ ...f, zone: e.target.value }))}>
                  <option value="">— No zone assigned —</option>
                  {zones.map(z => (
                    <option key={z._id || z.id} value={z.name}>{z.name}</option>
                  ))}
                </select>
              </div>

            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.2rem' }}>
              <button className="btn btn-outline" onClick={() => setShowAddForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddDevice} disabled={addSaving}>
                {addSaving
                  ? <><i className="fi fi-rr-spinner" style={{ marginRight: 5 }} />Registering…</>
                  : <><i className="fi fi-rr-plus" style={{ marginRight: 5 }} />Register Device</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ── MetricBox ─────────────────────────────────────────────────────────────────
function MetricBox({ icon, label, value, alert, alertColor }) {
  return (
    <div style={{
      background: alert ? `${alertColor}11` : 'var(--bg)',
      border: alert ? `1px solid ${alertColor}44` : '1px solid transparent',
      borderRadius: 8, padding: '0.5rem', textAlign: 'center',
    }}>
      {icon && <i className={`fi ${icon}`} style={{ fontSize: '0.85rem', color: alert ? alertColor : 'var(--text-muted)', display: 'block', marginBottom: 2 }} />}
      <div style={{ fontSize: '0.62rem', color: alert ? alertColor : 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: '1rem', color: alert ? alertColor : 'inherit' }}>{value}</div>
    </div>
  );
}
