import { useState, useEffect, useCallback } from 'react';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { historyApi } from '../services/api';

// Remove stale ROLE_BANNER constant (banner was the old subtext — now removed)
const TYPE_BADGE = { info: 'badge-info', success: 'badge-success', warning: 'badge-warning', danger: 'badge-danger' };
const TYPE_ICON  = {
  info:    <i className="fi fi-rr-info" />,
  success: <i className="fi fi-rr-check" />,
  warning: <i className="fi fi-rr-triangle-warning" />,
  danger:  <i className="fi fi-rr-hexagon-exclamation" />,
};

export default function History() {
  const { t }    = useLang();
  const { user } = useAuth();
  const today   = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

  const canDelete   = ['owner', 'admin'].includes(user?.role);
  const canClearAll = user?.role === 'owner';

  const [events, setEvents]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch]         = useState('');
  const [dateFrom, setDateFrom]     = useState(weekAgo);
  const [dateTo, setDateTo]         = useState(today);

  const fetchHistory = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await historyApi.getAll({ from: dateFrom, to: dateTo, type: typeFilter !== 'all' ? typeFilter : '' });
      setEvents(data);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [dateFrom, dateTo, typeFilter]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const filtered = events.filter(e => {
    if (!search) return true;
    const q = search.toLowerCase();
    return e.event?.toLowerCase().includes(q) || e.user?.toLowerCase().includes(q) ||
           e.zone?.toLowerCase().includes(q)  || e.details?.toLowerCase().includes(q);
  });

  const exportCSV = () => {
    if (!filtered.length) return;
    const keys = Object.keys(filtered[0]);
    const csv  = [keys.join(','), ...filtered.map(r => keys.map(k => `"${r[k] ?? ''}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url; a.download = 'history.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this history record permanently?')) return;
    try {
      await historyApi.remove(id);
      setEvents(prev => prev.filter(e => String(e.id || e._id) !== String(id)));
    } catch (err) { setError(err.message); }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Delete ALL history records permanently? This cannot be undone.')) return;
    try {
      await historyApi.removeAll();
      setEvents([]);
    } catch (err) { setError(err.message); }
  };

  return (
    <div>
      <div className="page-header">
        <h1><i className="fi fi-rr-time-past" style={{ marginRight: 8 }} />{t('historyTitle')}</h1>
        <div className="header-actions">
          <button className="btn btn-secondary btn-sm" onClick={fetchHistory} disabled={loading}>
            <i className="fi fi-rr-refresh" style={{ marginRight: 4 }} />{t('refresh')}
          </button>
          {filtered.length > 0 && (
            <button className="btn btn-outline btn-sm" onClick={exportCSV}>
              <i className="fi fi-rr-download" style={{ marginRight: 4 }} />{t('export')}
            </button>
          )}
          {canClearAll && events.length > 0 && (
            <button className="btn btn-sm"
              onClick={handleClearAll}
              style={{ background:'#fee2e2', color:'#991b1b', border:'1px solid #fca5a5', borderRadius:7, padding:'4px 12px', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}>
              <i className="fi fi-rr-trash" />
              {t('delete')} {t('all')}
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
            <i className="fi fi-rr-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.85rem' }} />
            <input
              type="search"
              placeholder={`${t('filterBy')}…`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', paddingLeft: 32 }}
            />
          </div>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} max={dateTo} style={{ width: 'auto' }} />
          <input type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)}   min={dateFrom} max={today} style={{ width: 'auto' }} />
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {['all','info','success','warning','danger'].map(f => (
              <button key={f} onClick={() => setTypeFilter(f)}
                className={`btn btn-sm ${typeFilter === f ? 'btn-primary' : 'btn-outline'}`}
                style={{ textTransform: 'capitalize' }}>
                {f === 'all' ? t('all') : <>{TYPE_ICON[f]} {f}</>}
              </button>
            ))}
          </div>
          {(search || typeFilter !== 'all') && (
            <button className="btn btn-outline btn-sm" onClick={() => { setSearch(''); setTypeFilter('all'); }}>
              <i className="fi fi-rr-cross-small" style={{ marginRight: 3 }} />Clear
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <i className="fi fi-rr-triangle-warning" style={{ marginRight: 6 }} />{error}&nbsp;
          <button className="btn btn-sm btn-outline" onClick={fetchHistory}>Retry</button>
        </div>
      )}

      {/* Summary badges */}
      {!loading && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <span className="badge badge-gray">{filtered.length} {t('event')}s</span>
          <span className="badge badge-success">{filtered.filter(e => e.type === 'success').length} completed</span>
          <span className="badge badge-warning">{filtered.filter(e => e.type === 'warning').length} warnings</span>
          <span className="badge badge-danger">{filtered.filter(e => e.type === 'danger').length} alerts</span>
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} style={{ height: 44, background: '#e5e7eb', borderRadius: 8, animation: 'pulse 1.5s infinite' }}>
              <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
            </div>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && !error && (
        <div className="chart-box">
          <span className="ch-icon"><i className="fi fi-rr-inbox" /></span>
          {t('noRecords')}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('date')}</th>
                  <th>{t('time')}</th>
                  <th>{t('event')}</th>
                  <th>{t('user')}</th>
                  <th>Zone</th>
                  <th>{t('details')}</th>
                  <th>Type</th>
                  {canDelete && <th style={{ width: 40 }}></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => (
                  <tr key={e.id ?? i}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem', color: 'var(--text-muted)' }}>{e.date}</td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem', color: 'var(--text-muted)' }}>{e.time}</td>
                    <td style={{ fontWeight: 600, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ flexShrink: 0 }}>{TYPE_ICON[e.type]}</span>{e.event}
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{e.user}</td>
                    <td>
                      {e.zone && e.zone !== '—'
                        ? <span className="badge badge-info" style={{ fontSize: '0.72rem' }}>{e.zone}</span>
                        : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: 220 }}>{e.details}</td>
                    <td><span className={`badge ${TYPE_BADGE[e.type] ?? 'badge-gray'}`}>{e.type}</span></td>
                    {canDelete && (
                      <td>
                        <button
                          onClick={() => handleDelete(e.id || e._id)}
                          title={t('delete')}
                          style={{ background:'none', border:'none', cursor:'pointer', color:'#d1d5db', padding:'2px 4px', borderRadius:4, fontSize:'0.85rem' }}
                          onMouseEnter={ev => ev.currentTarget.style.color='#ef4444'}
                          onMouseLeave={ev => ev.currentTarget.style.color='#d1d5db'}>
                          <i className="fi fi-rr-trash" />
                        </button>
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
