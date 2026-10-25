/**
 * ForceChangePassword
 * Shown to any user whose account was created by the Owner with a temporary password.
 * The user MUST change their password before accessing the dashboard.
 * Cannot be skipped — all other routes redirect here while mustChangePassword is true.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import logoImg from '../assets/logo.jpg';

// Strong-password regex (mirrors backend)
const PW_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

function getPasswordStrength(pw) {
  if (!pw) return { score: 0, label: '', color: '#e5e7eb' };
  let score = 0;
  if (pw.length >= 8)                                         score++;
  if (/[A-Z]/.test(pw))                                       score++;
  if (/[a-z]/.test(pw))                                       score++;
  if (/\d/.test(pw))                                          score++;
  if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw))       score++;
  const labels = ['', 'Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
  const colors = ['#e5e7eb', '#ef4444', '#f97316', '#f59e0b', '#3b82f6', '#22c55e'];
  return { score, label: labels[score] || '', color: colors[score] };
}

export default function ForceChangePassword() {
  const { user, forceChangePassword, logout } = useAuth();
  const { lang, switchLang } = useLang();
  const navigate = useNavigate();

  const [tempPw,   setTempPw]   = useState('');
  const [newPw,    setNewPw]    = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showTemp, setShowTemp] = useState(false);
  const [showNew,  setShowNew]  = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [touched,  setTouched]  = useState({});

  const touch = (f) => setTouched(p => ({ ...p, [f]: true }));
  const touchAll = () => setTouched({ tempPw: true, newPw: true, confirmPw: true });

  const strength = getPasswordStrength(newPw);

  const errs = {
    tempPw:    !tempPw    ? 'Temporary password is required.'    : '',
    newPw:     !newPw     ? 'New password is required.'
               : !PW_REGEX.test(newPw)
                 ? 'Min 8 chars with uppercase, lowercase, number and special character.'
                 : tempPw === newPw
                   ? 'New password must be different from the temporary password.'
                   : '',
    confirmPw: !confirmPw ? 'Please confirm your new password.'
               : newPw !== confirmPw ? 'Passwords do not match.' : '',
  };
  const hasErrors = Object.values(errs).some(Boolean);

  const handleSubmit = async (e) => {
    e.preventDefault();
    touchAll();
    setError('');
    if (hasErrors) return;

    setLoading(true);
    const result = await forceChangePassword(tempPw, newPw);
    setLoading(false);

    if (result.success) {
      navigate('/home', { replace: true });
    } else {
      setError(result.message || 'Failed to change password. Please try again.');
    }
  };

  const handleLogout = () => { logout(); navigate('/login', { replace: true }); };

  const FieldError = ({ field }) =>
    touched[field] && errs[field]
      ? <span style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
          <i className="fi fi-rr-cross-circle" /> {errs[field]}
        </span>
      : null;

  const borderStyle = (f) => touched[f] && errs[f] ? { borderColor: '#ef4444' } : {};

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem 1rem',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 20,
        boxShadow: '0 12px 48px rgba(22,101,52,0.15)',
        padding: '2.4rem 2rem',
        width: '100%',
        maxWidth: 460,
        border: '1.5px solid #bbf7d0',
      }}>

        {/* Language switcher */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <div className="lang-pill">
            <button className={lang === 'en' ? 'active' : ''} onClick={() => switchLang('en')}>EN</button>
            <button className={lang === 'am' ? 'active' : ''} onClick={() => switchLang('am')}>አማ</button>
          </div>
        </div>

        {/* Logo + title */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <img
            src={logoImg}
            alt="Logo"
            style={{ width: 80, height: 80, borderRadius: 12, objectFit: 'contain', background: '#f0fdf4', padding: 4, boxShadow: '0 4px 16px rgba(22,101,52,0.2)', marginBottom: '0.8rem' }}
          />
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: '#fef9c3', border: '1.5px solid #fde047',
            borderRadius: 10, padding: '8px 16px', marginBottom: '0.8rem',
          }}>
            <i className="fi fi-rr-key" style={{ color: '#ca8a04', fontSize: '1.1rem' }} />
            <span style={{ fontSize: '0.82rem', color: '#92400e', fontWeight: 600 }}>
              {lang === 'am' ? 'ጊዜያዊ የይለፍ ቃል ለውጥ ያስፈልጋል' : 'Temporary password — change required'}
            </span>
          </div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#14532d', margin: 0 }}>
            {lang === 'am' ? 'አዲስ የይለፍ ቃል ያቅናቡ' : 'Set Your New Password'}
          </h1>
          {user && (
            <p style={{ fontSize: '0.83rem', color: '#6b7280', marginTop: 6 }}>
              {lang === 'am' ? `ሰላም, ${user.name}!` : `Welcome, ${user.name}!`}
              {' '}
              {lang === 'am'
                ? 'ወደ ስርዓቱ ከመግባትዎ በፊት የይለፍ ቃልዎን ይለውጡ።'
                : 'Please change your temporary password to continue.'}
            </p>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
            <i className="fi fi-rr-triangle-warning" style={{ marginRight: 6 }} />{error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>

          {/* Temporary password */}
          <div className="form-group">
            <label>
              {lang === 'am' ? 'ጊዜያዊ የይለፍ ቃል' : 'Temporary Password'}
              <span style={{ color: '#ef4444' }}> *</span>
            </label>
            <div className="pw-wrap">
              <input
                type={showTemp ? 'text' : 'password'}
                autoComplete="current-password"
                value={tempPw}
                onChange={(e) => { setTempPw(e.target.value); setError(''); }}
                onBlur={() => touch('tempPw')}
                placeholder="Enter temporary password"
                style={borderStyle('tempPw')}
              />
              <button type="button" className="toggle-pw" onClick={() => setShowTemp(!showTemp)} tabIndex={-1}>
                <i className={`fi ${showTemp ? 'fi-rr-eye-crossed' : 'fi-rr-eye'}`} />
              </button>
            </div>
            <FieldError field="tempPw" />
          </div>

          {/* New password */}
          <div className="form-group">
            <label>
              {lang === 'am' ? 'አዲስ የይለፍ ቃል' : 'New Password'}
              <span style={{ color: '#ef4444' }}> *</span>
            </label>
            <div className="pw-wrap">
              <input
                type={showNew ? 'text' : 'password'}
                autoComplete="new-password"
                value={newPw}
                onChange={(e) => { setNewPw(e.target.value); setError(''); }}
                onBlur={() => touch('newPw')}
                placeholder="Min 8 chars, uppercase, number, symbol"
                style={borderStyle('newPw')}
              />
              <button type="button" className="toggle-pw" onClick={() => setShowNew(!showNew)} tabIndex={-1}>
                <i className={`fi ${showNew ? 'fi-rr-eye-crossed' : 'fi-rr-eye'}`} />
              </button>
            </div>

            {/* Strength bar */}
            {newPw && (
              <div style={{ marginTop: 6 }}>
                <div style={{ display: 'flex', gap: 3, marginBottom: 3 }}>
                  {[1,2,3,4,5].map(i => (
                    <div key={i} style={{
                      flex: 1, height: 4, borderRadius: 4,
                      background: i <= strength.score ? strength.color : '#e5e7eb',
                      transition: 'background 0.3s',
                    }} />
                  ))}
                </div>
                <span style={{ fontSize: '0.72rem', color: strength.color, fontWeight: 600 }}>
                  {strength.label}
                </span>
              </div>
            )}
            <FieldError field="newPw" />
          </div>

          {/* Confirm password */}
          <div className="form-group">
            <label>
              {lang === 'am' ? 'የይለፍ ቃሉን ያረጋግጡ' : 'Confirm New Password'}
              <span style={{ color: '#ef4444' }}> *</span>
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPw}
              onChange={(e) => { setConfirmPw(e.target.value); setError(''); }}
              onBlur={() => touch('confirmPw')}
              placeholder="Re-enter new password"
              style={borderStyle('confirmPw')}
            />
            <FieldError field="confirmPw" />
          </div>

          <button
            className="auth-submit"
            type="submit"
            disabled={loading}
            style={{ marginTop: '0.5rem' }}
          >
            {loading
              ? <><i className="fi fi-rr-spinner" style={{ marginRight: 6 }} />{lang === 'am' ? 'በማስቀመጥ ላይ…' : 'Saving…'}</>
              : <><i className="fi fi-rr-lock" style={{ marginRight: 6 }} />{lang === 'am' ? 'የይለፍ ቃል ለውጥ' : 'Change Password & Continue'}</>
            }
          </button>
        </form>

        {/* Logout link */}
        <p style={{ textAlign: 'center', marginTop: '1.2rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          {lang === 'am' ? 'ለዚህ አካውንት አልሆነም?' : 'Not your account?'}{' '}
          <button
            onClick={handleLogout}
            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', padding: 0 }}
          >
            {lang === 'am' ? 'ውጣ' : 'Sign out'}
          </button>
        </p>
      </div>
    </div>
  );
}
