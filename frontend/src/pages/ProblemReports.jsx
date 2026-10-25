import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { problemReportApi } from '../services/api';

const PROBLEM_TYPES = [
  { value: 'pump',                   labelKey: 'pumpProblem',           icon: 'fi-rr-engine-warning' },
  { value: 'pipe_leakage',           labelKey: 'pipeLeakage',           icon: 'fi-rr-pipe' },
  { value: 'low_water',              labelKey: 'lowWater',              icon: 'fi-rr-tint-slash' },
  { value: 'sensor',                 labelKey: 'sensorProblem',         icon: 'fi-rr-microchip' },
  { value: 'irrigation_not_working', labelKey: 'irrigationNotWorking',  icon: 'fi-rr-cross-circle' },
  { value: 'equipment',              labelKey: 'equipmentIssue',        icon: 'fi-rr-settings' },
  { value: 'crop',                   labelKey: 'cropIssue',             icon: 'fi-rr-leaf' },
  { value: 'power',                  labelKey: 'powerIssue',            icon: 'fi-rr-bolt' },
  { value: 'other',                  labelKey: 'otherProblem',          icon: 'fi-rr-info' },
];

const STATUS_BADGES = {
  open:      { label: 'OPEN',      bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
  in_review: { label: 'IN REVIEW', bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  resolved:  { label: 'RESOLVED',  bg: '#dcfce7', color: '#166534', border: '#86efac' },
};

const PRIORITY_BADGES = {
  low:    { label: 'Low',    bg: '#f3f4f6', color: '#4b5563' },
  medium: { label: 'Medium', bg: '#e0f2fe', color: '#0369a1' },
  high:   { label: 'High',   bg: '#ffedd5', color: '#c2410c' },
  urgent: { label: 'Urgent', bg: '#ffe4e6', color: '#be123c' },
};

export default function ProblemReports() {
  const { user } = useAuth();
  const { t }    = useLang();
  const isLabor = user?.role === 'labor';

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');
  const [filter,  setFilter]  = useState('all');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    problemType: 'pump',
    farm: user?.farmName || 'Main Farm',
    field: 'Field A',
    description: '',
    priority: 'medium',
    imageUrl: '',
  });

  // Manager status change state
  const [updatingId, setUpdatingId] = useState(null);
  const [resolveNote, setResolveNote] = useState('');

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await problemReportApi.getAll();
      setReports(Array.isArray(data) ? data : data?.reports || []);
    } catch (err) {
      setError(err.message || 'Failed to load problem reports.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.description.trim()) {
      setError('Description is required.');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await problemReportApi.create(formData);
      setSuccess('Problem report submitted successfully!');
      setModalOpen(false);
      setFormData({
        problemType: 'pump',
        farm: user?.farmName || 'Main Farm',
        field: 'Field A',
        description: '',
        priority: 'medium',
        imageUrl: '',
      });
      loadReports();
    } catch (err) {
      setError(err.message || 'Failed to submit report.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await problemReportApi.updateStatus(id, status, resolveNote);
      setSuccess(`Report status updated to ${status.replace('_', ' ').toUpperCase()}`);
      setUpdatingId(null);
      setResolveNote('');
      loadReports();
    } catch (err) {
      setError(err.message || 'Failed to update status.');
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError('Image file must be smaller than 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, imageUrl: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const filteredReports = filter === 'all'
    ? reports
    : reports.filter(r => r.status === filter);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: '2rem' }}>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '1.5rem', color: 'var(--text)' }}>
            <i className="fi fi-rr-triangle-warning" style={{ color: '#ef4444' }} />
            {t('problemReportsTitle')}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '4px 0 0' }}>
            {isLabor
              ? 'Report equipment, water level, pipe leakages, or sensor issues directly to management.'
              : 'Track and resolve reported farm and irrigation issues.'}
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => setModalOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.6rem 1.2rem', fontWeight: 600 }}
        >
          <i className="fi fi-rr-plus" /> Report New Problem
        </button>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="fi fi-rr-cross-circle" /> {error}
        </div>
      )}
      {success && (
        <div className="alert alert-success" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="fi fi-rr-check-circle" /> {success}
        </div>
      )}

      {/* Summary Filter Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { key: 'all',       label: 'Total Reports', count: reports.length, color: '#3b82f6', bg: '#eff6ff' },
          { key: 'open',      label: 'Open',          count: reports.filter(r => r.status === 'open').length, color: '#ef4444', bg: '#fef2f2' },
          { key: 'in_review', label: 'In Review',     count: reports.filter(r => r.status === 'in_review').length, color: '#f59e0b', bg: '#fffbeb' },
          { key: 'resolved',  label: 'Resolved',      count: reports.filter(r => r.status === 'resolved').length, color: '#10b981', bg: '#ecfdf5' },
        ].map(card => (
          <div
            key={card.key}
            onClick={() => setFilter(card.key)}
            style={{
              background: filter === card.key ? card.bg : '#fff',
              border: `2px solid ${filter === card.key ? card.color : '#e5e7eb'}`,
              borderRadius: 12, padding: '1rem', cursor: 'pointer', transition: 'all 0.2s',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}
          >
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{card.label}</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: card.color, marginTop: 4 }}>{card.count}</div>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${card.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fi fi-rr-bell" style={{ color: card.color }} />
            </div>
          </div>
        ))}
      </div>

      {/* Reports List */}
      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <i className="fi fi-rr-spinner spinner" style={{ fontSize: '2rem', display: 'block', marginBottom: 12 }} />
          Loading reports...
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="chart-box" style={{ textAlign: 'center', padding: '3rem 1.5rem', background: '#fff', borderRadius: 12, border: '1px dashed var(--border)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>📋</div>
          <h3 style={{ margin: 0, color: 'var(--text)' }}>{t('noReportsFound')}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: 4 }}>
              {filter === 'all' ? t('noRecords') : `${t('noRecords')} "${filter}".`}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.2rem' }}>
          {filteredReports.map(r => {
            const st = STATUS_BADGES[r.status] || STATUS_BADGES.open;
            const pr = PRIORITY_BADGES[r.priority] || PRIORITY_BADGES.medium;
            const pType = PROBLEM_TYPES.find(p => p.value === r.problemType) || { labelKey: 'otherProblem', icon: 'fi-rr-info' };

            return (
              <div
                key={r._id || r.id}
                style={{
                  background: '#fff',
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  padding: '1.2rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justify: 'space-between',
                  gap: 12,
                }}
              >
                <div>
                  {/* Top Badges */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{
                      background: st.bg, color: st.color, border: `1px solid ${st.border}`,
                      fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20
                    }}>
                      {st.label}
                    </span>

                    <span style={{
                      background: pr.bg, color: pr.color,
                      fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 20
                    }}>
                      Priority: {pr.label}
                    </span>
                  </div>

                  {/* Title & Type */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 10, background: 'var(--primary-light)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <i className={`fi ${pType.icon}`} style={{ color: 'var(--primary)', fontSize: '1.1rem' }} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: 'var(--text)' }}>
                        {t(pType.labelKey) || pType.labelKey}
                      </h4>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        📍 {r.farm || 'Farm'} {r.field ? `• ${r.field}` : ''}
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p style={{ fontSize: '0.85rem', color: '#374151', background: '#f9fafb', padding: '10px 12px', borderRadius: 8, margin: '8px 0', lineHeight: 1.5 }}>
                    {r.description}
                  </p>

                  {/* Optional Image */}
                  {r.imageUrl && (
                    <div style={{ marginTop: 8 }}>
                      <img
                        src={r.imageUrl}
                        alt="Reported problem evidence"
                        style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }}
                      />
                    </div>
                  )}

                  {/* Resolution Notes if Resolved */}
                  {r.status === 'resolved' && r.resolution && (
                    <div style={{ marginTop: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '8px 12px', borderRadius: 8 }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534' }}>
                        ✅ Resolution (by {r.resolvedByName || 'Management'}):
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#15803d', marginTop: 2 }}>
                        {r.resolution}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Info */}
                <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span>Reported by: <strong>{r.reportedByName || 'Laborer'}</strong></span>
                  <span>{new Date(r.createdAt).toLocaleDateString('en-ET', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                {/* Management Action Controls */}
                {!isLabor && r.status !== 'resolved' && (
                  <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 10, marginTop: 4 }}>
                    {updatingId === (r._id || r.id) ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <input
                          type="text"
                          placeholder="Resolution details..."
                          value={resolveNote}
                          onChange={e => setResolveNote(e.target.value)}
                          style={{ padding: '6px 10px', fontSize: '0.8rem', borderRadius: 6, border: '1px solid var(--border)' }}
                        />
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="btn btn-sm btn-success"
                            onClick={() => handleStatusChange(r._id || r.id, 'resolved')}
                            style={{ flex: 1 }}
                          >
                            Mark Resolved
                          </button>
                          <button
                            className="btn btn-sm btn-outline"
                            onClick={() => setUpdatingId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 8 }}>
                        {r.status === 'open' && (
                          <button
                            className="btn btn-sm btn-outline"
                            onClick={() => handleStatusChange(r._id || r.id, 'in_review')}
                            style={{ flex: 1 }}
                          >
                            Mark In Review
                          </button>
                        )}
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => { setUpdatingId(r._id || r.id); setResolveNote(''); }}
                          style={{ flex: 1 }}
                        >
                          Resolve Problem
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal for Creating Problem Report */}
      {modalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div style={{
            background: '#fff', borderRadius: 16, maxWidth: 540, width: '100%',
            maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.2rem' }}>
                <i className="fi fi-rr-triangle-warning" style={{ color: '#ef4444' }} />
                Report Farm Problem
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Problem Type */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}>
                  Problem Type <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={formData.problemType}
                  onChange={e => setFormData({ ...formData, problemType: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, border: '1px solid var(--border)', fontSize: '0.9rem' }}
                >
                  {PROBLEM_TYPES.map(p => (
                    <option key={p.value} value={p.value}>{t(p.labelKey)}</option>
                  ))}
                </select>
              </div>

              {/* Farm & Field */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}>
                    Farm Name
                  </label>
                  <input
                    type="text"
                    value={formData.farm}
                    onChange={e => setFormData({ ...formData, farm: e.target.value })}
                    placeholder="e.g. Main Farm"
                    style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, border: '1px solid var(--border)', fontSize: '0.9rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}>
                    Field / Location
                  </label>
                  <input
                    type="text"
                    value={formData.field}
                    onChange={e => setFormData({ ...formData, field: e.target.value })}
                    placeholder="e.g. Field A, Zone 2"
                    style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, border: '1px solid var(--border)', fontSize: '0.9rem' }}
                  />
                </div>
              </div>

              {/* Priority */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}>
                  Priority Level
                </label>
                <select
                  value={formData.priority}
                  onChange={e => setFormData({ ...formData, priority: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, border: '1px solid var(--border)', fontSize: '0.9rem' }}
                >
                  <option value="low">Low - Minor issue</option>
                  <option value="medium">Medium - Standard issue</option>
                  <option value="high">High - Action required soon</option>
                  <option value="urgent">Urgent - Pump/Leakage Critical</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}>
                  Description <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Describe the issue clearly (e.g., Pipe leak observed near valve 3, pump making abnormal noise...)"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, border: '1px solid var(--border)', fontSize: '0.9rem', resize: 'vertical' }}
                />
              </div>

              {/* Image Upload */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}>
                  Attach Photo / Image (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{ fontSize: '0.85rem' }}
                />
                {formData.imageUrl && (
                  <div style={{ marginTop: 8, position: 'relative', display: 'inline-block' }}>
                    <img src={formData.imageUrl} alt="preview" style={{ height: 80, borderRadius: 6, border: '1px solid var(--border)' }} />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, imageUrl: '' })}
                      style={{ position: 'absolute', top: -6, right: -6, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, fontSize: '0.7rem', cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setModalOpen(false)}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                  style={{ flex: 1 }}
                >
                  {submitting ? t('loading') : t('submitReport')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
