/**
 * LoginPage — Professional dual-panel layout
 *  Desktop: hero branding panel (left) + form panel (right)
 *  Mobile:  single card with logo + form
 */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { BASE_URL } from '../services/api';
import logoImg from '../assets/logo.jpg';
import bgImg   from '../assets/bg.jpg';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const { login, authLoading } = useAuth();
  const { t, lang, switchLang } = useLang();
  const navigate = useNavigate();

  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [showPw,      setShowPw]      = useState(false);
  const [error,       setError]       = useState('');
  const [touched,     setTouched]     = useState({ email: false, password: false });
  const [wakeMessage, setWakeMessage] = useState(false);

  // Pre-warm backend when login page opens so Render begins booting immediately
  useEffect(() => {
    fetch(`${BASE_URL}/health`).catch(() => {});
  }, []);

  // If signing in takes more than 4 seconds, show reassurance that server is waking up
  useEffect(() => {
    let timer;
    if (authLoading) {
      timer = setTimeout(() => setWakeMessage(true), 4000);
    } else {
      setWakeMessage(false);
    }
    return () => clearTimeout(timer);
  }, [authLoading]);

  const touch = (f) => setTouched(p => ({ ...p, [f]: true }));

  const emailErr    = !email.trim()                   ? 'Email is required.'
                    : !EMAIL_REGEX.test(email.trim())  ? 'Enter a valid email address.'
                    : '';
  const passwordErr = !password                       ? 'Password is required.'
                    : password.length < 8             ? 'Password must be at least 8 characters.'
                    : '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    setError('');
    if (emailErr || passwordErr) return;

    const result = await login(email.trim().toLowerCase(), password);
    if (result.success) {
      navigate(result.mustChangePassword ? '/force-change-password' : '/home', { replace: true });
    } else {
      const msg = result.message || t('loginError');
      setError(
        result.code === 'ACCOUNT_PENDING'
          ? 'Your account is waiting for admin approval. You will be notified by email once approved.' :
        result.code === 'ACCOUNT_REJECTED'
          ? 'Your registration was not approved. Please contact the Farm Administrator.' :
        result.code === 'ACCOUNT_SUSPENDED'
          ? 'Your account has been suspended. Contact the Farm Owner.' :
        result.code === 'ACCOUNT_DEACTIVATED'
          ? 'Your account is deactivated. Contact the Farm Owner.' :
        msg.includes('Cannot connect') || msg.includes('fetch') || msg.includes('offline') || msg.includes('unreachable')
          ? (lang === 'am' ? 'ሰርቨሩ ሊደረስበት አልቻለም። እባክዎ ጥቂት ቆይተው እንደገና ይሞክሩ።' : 'Cannot connect to server. The server may still be waking up — please wait a moment and try again.')
          : msg
      );
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#fff' }}>

      {/* ── LEFT: Hero/Branding panel ── */}
      <div style={{
        flex: '0 0 48%', display: 'flex', flexDirection: 'column',
        backgroundImage: `url(${bgImg})`, backgroundSize: 'cover', backgroundPosition: 'center',
        position: 'relative', overflow: 'hidden',
      }} className="login-hero">
        {/* overlay */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, rgba(10,40,15,0.85) 0%, rgba(22,101,52,0.78) 60%, rgba(21,128,61,0.72) 100%)' }} />

        <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', padding: '2.5rem 2.5rem' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src={logoImg} alt="logo" style={{ width: 52, height: 52, borderRadius: 12, objectFit: 'contain', background: '#fff', padding: 4, boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#fff', lineHeight: 1.2 }}>
                Smart Irrigation System
              </div>
              <div style={{ fontSize: '0.7rem', color: '#86efac', opacity: 0.85 }}>
                ዘመናዊ የመስኖ ስርዓት
              </div>
            </div>
          </div>

          {/* Main content */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: '2rem' }}>
            <h1 style={{ fontSize: 'clamp(1.7rem,3vw,2.3rem)', fontWeight: 900, color: '#fff', lineHeight: 1.2, marginBottom: '1rem', textShadow: '0 2px 12px rgba(0,0,0,0.4)' }}>
              Intelligent Farm<br />Water Management
            </h1>
            <p style={{ fontSize: '0.88rem', color: '#bbf7d0', lineHeight: 1.8, maxWidth: 360, marginBottom: '2rem', opacity: 0.9 }}>
              Real-time IoT sensor monitoring, automated irrigation control, and multi-role farm management — built for Ethiopian agriculture.
            </p>
          </div>

          {/* Footer */}
          <div style={{ fontSize: '0.7rem', color: '#86efac', opacity: 0.6 }}>
            <i className="fi fi-rr-graduation-cap" style={{ marginRight: 5 }} />
            Bahir Dar University · Amhara Region, Ethiopia
          </div>
        </div>
      </div>

      {/* ── RIGHT: Form panel ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem', background: '#fafafa', minWidth: 0 }}>
        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* Lang switcher */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
            <div className="lang-pill">
              <button className={lang === 'en' ? 'active' : ''} onClick={() => switchLang('en')}>EN</button>
              <button className={lang === 'am' ? 'active' : ''} onClick={() => switchLang('am')}>አማ</button>
            </div>
          </div>

          {/* Logo (mobile only) */}
          <div style={{ textAlign: 'center', marginBottom: '1.8rem' }} className="login-mobile-logo">
            <img src={logoImg} alt="logo" style={{ width: 80, height: 80, borderRadius: 16, objectFit: 'contain', background: '#fff', padding: 4, boxShadow: '0 4px 20px rgba(45,122,58,0.15)', marginBottom: '0.6rem' }} />
            <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary-dark)', margin: 0 }}>{t('appName')}</h1>
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.25rem' }}>Welcome back</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.8rem' }}>
            {lang === 'am' ? 'ኢሜይልዎን እና የይለፍ ቃልዎን ያስገቡ' : 'Sign in to your account to continue'}
          </p>

          {error && (
            <div className={`alert ${
              error.includes('waiting for admin approval') ? 'alert-warning' :
              error.includes('not been approved') || error.includes('not approved') ? 'alert-error' :
              'alert-error'
            }`} style={
              error.includes('waiting for admin approval')
                ? { background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e' }
                : {}
            }>
              <i className={`fi ${error.includes('waiting for admin approval') ? 'fi-rr-clock' : 'fi-rr-triangle-warning'}`} style={{ marginRight: 6 }} />{error}
            </div>
          )}

          <form onSubmit={handleSubmit} autoComplete="off" noValidate>
            <div className="form-group">
              <label htmlFor="login-email">{t('email')} <span style={{ color: '#ef4444' }}>*</span></label>
              <div style={{ position: 'relative' }}>
                <i className="fi fi-rr-envelope" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: touched.email && emailErr ? '#ef4444' : '#9ca3af', fontSize: '0.95rem', pointerEvents: 'none' }} />
                <input
                  id="login-email" type="email" autoComplete="new-password"
                  value={email} onChange={e => { setEmail(e.target.value); setError(''); }}
                  onBlur={() => touch('email')}
                  placeholder="your@email.com"
                  style={{ paddingLeft: '2.4rem', ...(touched.email && emailErr ? { borderColor: '#ef4444' } : {}) }}
                />
              </div>
              {touched.email && emailErr && <span style={{ fontSize: '0.73rem', color: '#ef4444', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}><i className="fi fi-rr-cross-circle" />{emailErr}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="login-password">{t('password')} <span style={{ color: '#ef4444' }}>*</span></label>
              <div className="pw-wrap">
                <i className="fi fi-rr-lock" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: touched.password && passwordErr ? '#ef4444' : '#9ca3af', fontSize: '0.95rem', pointerEvents: 'none', zIndex: 1 }} />
                <input
                  id="login-password" type={showPw ? 'text' : 'password'} autoComplete="new-password"
                  value={password} onChange={e => { setPassword(e.target.value); setError(''); }}
                  onBlur={() => touch('password')}
                  placeholder="••••••••"
                  style={{ paddingLeft: '2.4rem', ...(touched.password && passwordErr ? { borderColor: '#ef4444' } : {}) }}
                />
                <button type="button" className="toggle-pw" onClick={() => setShowPw(!showPw)} tabIndex={-1}>
                  <i className={`fi ${showPw ? 'fi-rr-eye-crossed' : 'fi-rr-eye'}`} />
                </button>
              </div>
              {touched.password && passwordErr && <span style={{ fontSize: '0.73rem', color: '#ef4444', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}><i className="fi fi-rr-cross-circle" />{passwordErr}</span>}
            </div>

            <button className="auth-submit" type="submit" disabled={authLoading} style={{ marginTop: '0.75rem', padding: '0.82rem' }}>
              {authLoading
                ? <><i className="fi fi-rr-spinner" />{lang === 'am' ? 'በመጫን ላይ…' : 'Signing in…'}</>
                : <><i className="fi fi-rr-sign-in-alt" />{lang === 'am' ? 'ወደ ስርዓቱ ይግቡ' : 'Sign In'}</>
              }
            </button>
            {authLoading && wakeMessage && (
              <div style={{
                fontSize: '0.78rem',
                color: '#15803d',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 8,
                padding: '8px 12px',
                marginTop: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <i className="fi fi-rr-cloud" style={{ fontSize: '0.9rem', flexShrink: 0 }} />
                <span>
                  {lang === 'am'
                    ? 'ሰርቨሩ በመነሳት ላይ ነው፣ እባክዎ ጥቂት ሰከንዶች ይጠብቁ…'
                    : 'Server is waking up from idle mode, please wait a moment…'}
                </span>
              </div>
            )}
          </form>

          <p className="auth-footer" style={{ marginTop: '1.4rem' }}>
            {lang === 'am' ? 'አካውንት የለዎትም?' : "Don't have an account?"}{' '}
            <Link to="/register">{lang === 'am' ? 'ይመዝገቡ' : 'Sign up'}</Link>
          </p>
        </div>
      </div>

      <style>{`
        .login-hero { display: flex !important; }
        .login-mobile-logo { display: none !important; }
        @media (max-width: 768px) {
          .login-hero { display: none !important; }
          .login-mobile-logo { display: block !important; }
        }
      `}</style>
    </div>
  );
}
