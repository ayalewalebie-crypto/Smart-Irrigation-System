import { useState, useRef } from 'react';
import { useAuth, ROLE_LABEL, ROLE_COLOR } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';

const ROLE_ICONS = {
  owner:          '👑',
  admin:          '🛡️',
  office_manager: '💼',
  labor:          '👷',
};

// Load saved photo from localStorage
function getSavedPhoto(userId) {
  return localStorage.getItem(`sis_photo_${userId}`) || null;
}

export default function Profile() {
  const { user, updateProfile, changePassword } = useAuth();
  const { t } = useLang();

  const fileInputRef = useRef(null);

  const [photo, setPhoto]       = useState(() => getSavedPhoto(user?.id || user?._id));
  const [editing, setEditing]   = useState(false);
  const [changePw, setChangePw] = useState(false);
  const [toast, setToast]       = useState('');
  const [error, setError]       = useState('');
  const [saving, setSaving]     = useState(false);
  const [photoHover, setPhotoHover] = useState(false);

  const [form, setForm] = useState({
    name:     user?.name     || '',
    phone:    user?.phone    || '',
    farmName: user?.farmName || '',
    location: user?.location || '',
  });
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });

  const set   = (f) => (e) => setForm({ ...form, [f]: e.target.value });
  const setPw = (f) => (e) => setPwForm({ ...pwForm, [f]: e.target.value });

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  // ── Photo upload ────────────────────────────────────────────────────────────
  const handlePhotoClick = () => fileInputRef.current?.click();

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type and size (max 2 MB)
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be smaller than 2 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target.result;
      setPhoto(base64);
      // Persist per user
      const uid = user?.id || user?._id;
      if (uid) localStorage.setItem(`sis_photo_${uid}`, base64);
      showToast('Photo updated!');
    };
    reader.readAsDataURL(file);
    // Clear input so same file can be re-selected
    e.target.value = '';
  };

  const removePhoto = () => {
    setPhoto(null);
    const uid = user?.id || user?._id;
    if (uid) localStorage.removeItem(`sis_photo_${uid}`);
    showToast('Photo removed.');
  };

  // ── Shared validators ───────────────────────────────────────────────────────
  const NAME_REGEX = /^[a-zA-Z\u1200-\u137F\s'\-]+$/;
  const PW_REGEX   = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

  // ── Profile update ──────────────────────────────────────────────────────────
  const handleUpdate = async () => {
    if (!form.name.trim()) { setError('Name is required.'); return; }
    if (!NAME_REGEX.test(form.name.trim())) { setError('Name must contain letters only — no numbers or special characters.'); return; }
    if (form.phone    && form.phone.trim().length    > 20) { setError('Phone number is too long.'); return; }
    if (form.farmName && form.farmName.trim().length > 80) { setError('Farm name is too long.'); return; }
    if (form.location && form.location.trim().length > 80) { setError('Location is too long.'); return; }
    setSaving(true);
    setError('');
    const result = await updateProfile(form);
    setSaving(false);
    if (result.success) { showToast(t('saved')); setEditing(false); }
    else setError(result.message || 'Update failed.');
  };

  // ── Password change ─────────────────────────────────────────────────────────
  const handlePwChange = async () => {
    if (!pwForm.current) { setError('Current password is required.'); return; }
    if (!PW_REGEX.test(pwForm.newPw)) {
      setError('New password must be ≥8 chars and include uppercase, lowercase, a number and a special character.');
      return;
    }
    if (pwForm.newPw !== pwForm.confirm) { setError('Passwords do not match.'); return; }
    if (pwForm.current === pwForm.newPw) { setError('New password must differ from your current password.'); return; }
    setSaving(true);
    setError('');
    const result = await changePassword(pwForm.current, pwForm.newPw);
    setSaving(false);
    if (result.success) {
      showToast('Password updated!');
      setChangePw(false);
      setPwForm({ current: '', newPw: '', confirm: '' });
    } else {
      setError(result.message || 'Password change failed.');
    }
  };

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const roleColor = ROLE_COLOR[user?.role] || 'var(--primary)';

  return (
    <div>
      <div className="page-header">
        <h1>👤 {t('profileTitle')}</h1>
      </div>

      {toast && <div className="alert alert-success">✅ {toast}</div>}
      {error && <div className="alert alert-error">❌ {error}</div>}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handlePhotoChange}
      />

      <div className="grid-2">
        {/* ── Profile card ──────────────────────────────────────────────── */}
        <div className="card">

          {/* Avatar with click-to-upload */}
          <div style={{ textAlign: 'center', marginBottom: '1.2rem' }}>
            <div
              style={{ position: 'relative', display: 'inline-block', cursor: 'pointer' }}
              onMouseEnter={() => setPhotoHover(true)}
              onMouseLeave={() => setPhotoHover(false)}
              onClick={handlePhotoClick}
              title="Click to change photo"
            >
              {/* Avatar circle */}
              {photo ? (
                <img
                  src={photo}
                  alt="Profile"
                  style={{
                    width: 96, height: 96,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: `4px solid ${roleColor}`,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    display: 'block',
                    transition: 'filter 0.2s',
                    filter: photoHover ? 'brightness(0.7)' : 'none',
                  }}
                />
              ) : (
                <div style={{
                  width: 96, height: 96,
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${roleColor}, var(--primary-dark))`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '2rem', fontWeight: 700, color: '#fff',
                  border: `4px solid ${roleColor}22`,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                  transition: 'filter 0.2s',
                  filter: photoHover ? 'brightness(0.7)' : 'none',
                }}>
                  {initials}
                </div>
              )}

              {/* Hover overlay — camera icon */}
              {photoHover && (
                <div style={{
                  position: 'absolute', inset: 0,
                  borderRadius: '50%',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  pointerEvents: 'none',
                }}>
                  <span style={{ fontSize: '1.5rem' }}>📷</span>
                  <span style={{ fontSize: '0.6rem', color: '#fff', fontWeight: 600, marginTop: 2 }}>
                    CHANGE
                  </span>
                </div>
              )}

              {/* Online indicator dot */}
              <span style={{
                position: 'absolute', bottom: 4, right: 4,
                width: 14, height: 14,
                background: '#22c55e',
                borderRadius: '50%',
                border: '2px solid #fff',
                boxShadow: '0 0 6px #22c55e',
              }} />
            </div>

            {/* Remove photo link — only if photo is set */}
            {photo && (
              <button
                onClick={removePhoto}
                style={{
                  display: 'block', margin: '6px auto 0',
                  background: 'none', border: 'none',
                  fontSize: '0.72rem', color: 'var(--danger)',
                  cursor: 'pointer', textDecoration: 'underline',
                }}
              >
                Remove photo
              </button>
            )}

            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0.75rem 0 0' }}>
              {user?.name}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.83rem', margin: '2px 0 6px' }}>
              {user?.email}
            </p>
            <span className="badge badge-info" style={{ fontSize: '0.78rem' }}>
              {ROLE_ICONS[user?.role]} {ROLE_LABEL[user?.role] || user?.role}
            </span>
          </div>

          {/* Info rows */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', fontSize: '0.88rem' }}>
            {[
              { label: t('farmName'),    value: user?.farmName || '—', icon: '🌿' },
              { label: t('location'),    value: user?.location || '—', icon: '📍' },
              { label: t('phone'),       value: user?.phone    || '—', icon: '📱' },
              { label: t('memberSince'), value: user?.joined   || '—', icon: '📅' },
            ].map(({ label, value, icon }) => (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.45rem 0', borderBottom: '1px solid var(--border)',
              }}>
                <span style={{ color: 'var(--text-muted)' }}>{icon} {label}</span>
                <span style={{ fontWeight: 500 }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => { setEditing(!editing); setChangePw(false); setError(''); }}
            >
              ✏️ {t('editProfile')}
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => { setChangePw(!changePw); setEditing(false); setError(''); }}
            >
              🔑 {t('changePassword')}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handlePhotoClick}
              title="Upload profile photo"
            >
              📷 Photo
            </button>
          </div>
        </div>

        {/* ── Right column ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Edit form */}
          {editing && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">✏️ {t('editProfile')}</span>
              </div>
              <div className="form-group">
                <label>{t('fullName')}</label>
                <input value={form.name} onChange={set('name')} />
              </div>
              <div className="form-group">
                <label>{t('phone')}</label>
                <input value={form.phone} onChange={set('phone')} placeholder="+251..." />
              </div>
              <div className="form-group">
                <label>{t('farmName')}</label>
                <input value={form.farmName} onChange={set('farmName')} />
              </div>
              <div className="form-group">
                <label>{t('location')}</label>
                <input value={form.location} onChange={set('location')} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-primary" onClick={handleUpdate} disabled={saving}>
                  {saving ? '⏳' : `💾 ${t('update')}`}
                </button>
                <button className="btn btn-outline" onClick={() => { setEditing(false); setError(''); }}>
                  {t('cancel')}
                </button>
              </div>
            </div>
          )}

          {/* Change password form */}
          {changePw && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">🔑 {t('changePassword')}</span>
              </div>
              <div className="form-group">
                <label>{t('currentPassword')}</label>
                <input type="password" value={pwForm.current} onChange={setPw('current')} placeholder="••••••" />
              </div>
              <div className="form-group">
                <label>{t('newPassword')}</label>
                <input type="password" value={pwForm.newPw} onChange={setPw('newPw')} placeholder="min 6 chars" />
              </div>
              <div className="form-group">
                <label>{t('confirmPassword')}</label>
                <input type="password" value={pwForm.confirm} onChange={setPw('confirm')} placeholder="repeat" />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-primary" onClick={handlePwChange} disabled={saving}>
                  {saving ? '⏳' : `🔒 ${t('save')}`}
                </button>
                <button className="btn btn-outline" onClick={() => { setChangePw(false); setError(''); }}>
                  {t('cancel')}
                </button>
              </div>
            </div>
          )}

          {/* Account info card */}
          {!editing && !changePw && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">📋 {t('accountInfo')}</span>
              </div>
              <div style={{ fontSize: '0.88rem' }}>
                {[
                  { label: 'Email',        value: user?.email },
                  { label: t('roleLabel'), value: (
                    <span className="badge badge-info">
                      {ROLE_ICONS[user?.role]} {ROLE_LABEL[user?.role] || user?.role}
                    </span>
                  )},
                  { label: t('lastLogin'), value: new Date().toLocaleDateString() },
                ].map(({ label, value }, i, arr) => (
                  <div key={label} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.45rem 0',
                    borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                    <span style={{ fontWeight: 500 }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}


        </div>
      </div>
    </div>
  );
}
