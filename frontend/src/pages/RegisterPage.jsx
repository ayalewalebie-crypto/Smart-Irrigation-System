/**
 * RegisterPage — matches the design mockup:
 *   - Full-page farm background image
 *   - Centered white card with logo, title, subtitle
 *   - Single dropdown for role selection (no steps)
 *   - Icon-prefixed input fields
 *   - Terms & Conditions checkbox
 *   - Green "Create Account" button
 *   - "Already have an account? Sign in" footer
 *   - Bottom footer strip: Secure · Reliable · Smart Farming
 */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { BASE_URL } from '../services/api';
import logoImg from '../assets/logo.jpg';

const NAME_REGEX  = /^[a-zA-Z\u1200-\u137F\s'\-]+$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+]?[\d\s\-()]{7,15}$/;
const PW_REGEX    = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

const ROLES = [
  { value: 'admin',          label: 'Admin' },
  { value: 'office_manager', label: 'Office Manager' },
  { value: 'labor',          label: 'Laborer' },
  { value: 'owner',          label: 'Farm Owner' },
];

// ── Shared icon-input wrapper ─────────────────────────────────────────────────
function IconInput({ icon, error, children }) {
  return (
    <div style={{ position: 'relative' }}>
      <i className={`fi ${icon}`} style={{
        position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
        color: error ? '#ef4444' : '#9ca3af', fontSize: '0.95rem', pointerEvents: 'none',
      }} />
      {children}
    </div>
  );
}

export default function RegisterPage() {
  const { register }            = useAuth();
  const { lang, switchLang }    = useLang();
  const navigate                = useNavigate();

  const [form, setForm] = useState({
    role: '', firstName: '', lastName: '', email: '', phone: '', accountNumber: '',
    farmName: '', location: '',
    password: '', confirmPassword: '',
  });
  const [showPw,      setShowPw]      = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed,      setAgreed]      = useState(false);
  const [touched,     setTouched]     = useState({});
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState('');
  const [pending,     setPending]     = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [wakeMessage, setWakeMessage] = useState(false);

  // Pre-warm backend when registration page opens
  useEffect(() => {
    fetch(`${BASE_URL}/health`).catch(() => {});
  }, []);

  // Reassurance note if registration takes longer than 4s due to Render cold start
  useEffect(() => {
    let timer;
    if (loading) {
      timer = setTimeout(() => setWakeMessage(true), 4000);
    } else {
      setWakeMessage(false);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  const touch    = (f) => setTouched(p => ({ ...p, [f]: true }));
  const touchAll = () => setTouched({
    role: true, firstName: true, lastName: true, email: true, phone: true, accountNumber: true,
    farmName: true, location: true,
    password: true, confirmPassword: true, agreed: true,
  });
  const set = (field) => (e) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    setError('');
  };

  // Field-level validation
  const errs = {
    role:            !form.role ? 'Please select your role.' : '',
    firstName:       !form.firstName.trim()
                       ? 'First name is required.'
                       : !NAME_REGEX.test(form.firstName.trim())
                         ? 'Letters only — no numbers or symbols.'
                         : '',
    lastName:        !form.lastName.trim()
                       ? 'Last name is required.'
                       : !NAME_REGEX.test(form.lastName.trim())
                         ? 'Letters only — no numbers or symbols.'
                         : '',
    email:           !form.email.trim()
                       ? 'Email address is required.'
                       : !EMAIL_REGEX.test(form.email.trim())
                         ? 'Enter a valid email address.'
                         : '',
    phone:           form.phone && !PHONE_REGEX.test(form.phone)
                       ? 'Enter a valid phone number.' : '',
    accountNumber:   form.role !== 'owner' && !form.accountNumber.trim()
                       ? 'Account number is required.' : '',
    farmName:        form.role === 'owner' && !form.farmName.trim()
                       ? 'Farm name is required.' : '',
    location:        form.role === 'owner' && !form.location.trim()
                       ? 'Location is required.' : '',
    password:        !form.password
                       ? 'Password is required.'
                       : !PW_REGEX.test(form.password)
                         ? 'Min 8 chars — uppercase, lowercase, number & symbol.'
                         : '',
    confirmPassword: !form.confirmPassword
                       ? 'Please confirm your password.'
                       : form.password !== form.confirmPassword
                         ? 'Passwords do not match.'
                         : '',
    agreed:          !agreed ? 'You must agree to the Terms & Conditions.' : '',
  };
  const hasErrors = Object.values(errs).some(Boolean);

  const handleSubmit = async (e) => {
    e.preventDefault();
    touchAll();
    setError(''); setSuccess('');
    if (hasErrors) return;

    setLoading(true);
    const payload = {
      ...form,
      name: `${form.firstName.trim()} ${form.lastName.trim()}`,
    };
    const result = await register(payload);
    setLoading(false);

    if (result.success) {
      if (result.pending) {
        // Non-owner: show pending notice, do NOT redirect
        setPending(true);
        setSuccess('');
      } else {
        // Owner: active immediately, redirect to login
        setSuccess(lang === 'am' ? 'አካውንቱ ተፈጥሯል!' : 'Account created! Redirecting to sign in…');
        setTimeout(() => navigate('/login'), 1600);
      }
    } else {
      const msg = result.message || 'Registration failed.';
      setError(
        msg === 'Endpoint not found.'
          ? (lang === 'am' ? 'የሰርቨር ችግር አጋጥሟል። እባክዎ ጥቂት ቆይተው እንደገና ይሞክሩ።' : 'Cannot reach registration endpoint. The server may still be updating — please wait a moment and try again.') :
        msg.includes('Cannot connect') || msg.includes('fetch') || msg.includes('offline') || msg.includes('unreachable')
          ? (lang === 'am' ? 'ሰርቨሩ ሊደረስበት አልቻለም። እባክዎ ጥቂት ቆይተው እንደገና ይሞክሩ።' : 'Cannot connect to server. The server may be waking up — please wait a moment and try again.')
          : msg
      );
    }
  };

  // Inline error label
  const ErrLabel = ({ field }) =>
    touched[field] && errs[field] ? (
      <span style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
        <i className="fi fi-rr-cross-circle" />{errs[field]}
      </span>
    ) : null;

  const inputStyle = (field) => ({
    width: '100%',
    padding: '0.62rem 0.75rem 0.62rem 2.4rem',
    border: `1.5px solid ${touched[field] && errs[field] ? '#ef4444' : '#d1d5db'}`,
    borderRadius: 8,
    fontSize: '0.88rem',
    outline: 'none',
    background: '#fff',
    color: '#111827',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  });

  const pwInputStyle = (field) => ({
    ...inputStyle(field),
    paddingRight: '2.6rem',
  });

  return (
    <div style={{
      minHeight: '100vh',
      background: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
    }}>

      {/* ── White card ────────────────────────────────────────────────────── */}
      <div style={{
        background: 'rgba(255,255,255,0.97)',
        borderRadius: 18,
        boxShadow: '0 12px 48px rgba(0,0,0,0.18)',
        padding: '2.2rem 2rem 1.5rem',
        width: '100%',
        maxWidth: 560,
      }}>

        {/* Lang switcher */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
          <div className="lang-pill">
            <button className={lang === 'en' ? 'active' : ''} onClick={() => switchLang('en')}>EN</button>
            <button className={lang === 'am' ? 'active' : ''} onClick={() => switchLang('am')}>አማ</button>
          </div>
        </div>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <img
            src={logoImg}
            alt="Smart Irrigation Logo"
            style={{
              width: 90, height: 90,
              borderRadius: '50%',
              objectFit: 'contain',
              background: '#fff',
              padding: 4,
              boxShadow: '0 4px 20px rgba(22,101,52,0.25)',
              border: '3px solid #dcfce7',
            }}
          />
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#14532d', margin: '0.6rem 0 0.15rem' }}>
            Smart Irrigation &amp; Farm Management
          </h1>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#166534', margin: '0 0 0.15rem' }}>
            {lang === 'am' ? 'አካውንቱን ፍጠር' : 'Create Your Account'}
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: 0 }}>
            {lang === 'am'
              ? 'ዝርዝሮችዎን ይሙሉ እና ወደ ስርዓቱ ይግቡ'
              : 'Fill in your details below to create your account and access the system.'}
          </p>
        </div>

        {/* Alerts */}
        {error   && (
          <div className="alert alert-error" style={{ marginBottom: '0.75rem', whiteSpace: 'pre-line' }}>
            <i className="fi fi-rr-triangle-warning" style={{ marginRight: 6 }} />{error}
          </div>
        )}
        {success && (
          <div className="alert alert-success" style={{ marginBottom: '0.75rem' }}>
            <i className="fi fi-rr-check" style={{ marginRight: 6 }} />{success}
          </div>
        )}

        {/* ── Pending approval notice — shown after non-owner registration ── */}
        {pending && (
          <div style={{
            background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: 12,
            padding: '1.5rem', textAlign: 'center',
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>⏳</div>
            <h3 style={{ color: '#92400e', fontWeight: 800, margin: '0 0 0.5rem', fontSize: '1.05rem' }}>
              Registration Submitted
            </h3>
            <p style={{ color: '#78350f', fontSize: '0.88rem', lineHeight: 1.6, margin: '0 0 1rem' }}>
              Your account is <strong>pending admin approval</strong>. You will receive an email notification once your account has been reviewed.
            </p>
            <p style={{ color: '#92400e', fontSize: '0.82rem', margin: '0 0 1.2rem', opacity: 0.8 }}>
              Please do not register again with the same email.
            </p>
            <button
              onClick={() => navigate('/login')}
              style={{
                background: '#166534', color: '#fff', border: 'none', borderRadius: 8,
                padding: '0.65rem 1.5rem', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
              }}
            >
              <i className="fi fi-rr-sign-in-alt" style={{ marginRight: 6 }} />
              Back to Sign In
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} autoComplete="off" noValidate style={{ display: pending ? 'none' : 'block' }}>

          {/* ── Role dropdown ── */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#374151', marginBottom: 5 }}>
              {lang === 'am' ? 'ሚናዎን ይምረጡ' : 'Select Your Role'} <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <select
                value={form.role}
                onChange={set('role')}
                onBlur={() => touch('role')}
                style={{
                  width: '100%',
                  padding: '0.65rem 2.4rem 0.65rem 0.9rem',
                  border: `1.5px solid ${touched.role && errs.role ? '#ef4444' : '#d1d5db'}`,
                  borderRadius: 8,
                  fontSize: '0.88rem',
                  color: form.role ? '#111827' : '#9ca3af',
                  background: '#fff',
                  appearance: 'none',
                  outline: 'none',
                  boxSizing: 'border-box',
                  cursor: 'pointer',
                }}
              >
                <option value="" disabled>{lang === 'am' ? '-- ሚናዎን ይምረጡ --' : '-- Select your role --'}</option>
                {ROLES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              {/* Custom chevron */}
              <i className="fi fi-rr-angle-small-down" style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                color: '#6b7280', fontSize: '1rem', pointerEvents: 'none',
              }} />
            </div>
            <ErrLabel field="role" />
          </div>

          {/* ── First Name + Last Name ── */}
          <div className="form-row" style={{ marginBottom: '0.85rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#374151', marginBottom: 5 }}>
                {lang === 'am' ? 'መጠሪያ ስም' : 'First Name'} <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <IconInput icon="fi-rr-user" error={touched.firstName && errs.firstName}>
                <input
                  type="text" name="reg-firstname" autoComplete="new-password"
                  value={form.firstName} onChange={set('firstName')} onBlur={() => touch('firstName')}
                  placeholder={lang === 'am' ? 'መጠሪያ ስምዎን ያስገቡ' : 'Enter your first name'}
                  style={inputStyle('firstName')}
                />
              </IconInput>
              <ErrLabel field="firstName" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#374151', marginBottom: 5 }}>
                {lang === 'am' ? 'የአባት ስም' : 'Last Name'} <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <IconInput icon="fi-rr-user" error={touched.lastName && errs.lastName}>
                <input
                  type="text" name="reg-lastname" autoComplete="new-password"
                  value={form.lastName} onChange={set('lastName')} onBlur={() => touch('lastName')}
                  placeholder={lang === 'am' ? 'የአባት ስምዎን ያስገቡ' : 'Enter your last name'}
                  style={inputStyle('lastName')}
                />
              </IconInput>
              <ErrLabel field="lastName" />
            </div>
          </div>

          {/* ── Email ── */}
          <div style={{ marginBottom: '0.85rem' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#374151', marginBottom: 5 }}>
              {lang === 'am' ? 'ኢሜይል አድራሻ' : 'Email Address'} <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <IconInput icon="fi-rr-envelope" error={touched.email && errs.email}>
              <input
                type="email" name="reg-email" autoComplete="new-password"
                value={form.email} onChange={set('email')} onBlur={() => touch('email')}
                placeholder={lang === 'am' ? 'ኢሜይልዎን ያስገቡ' : 'Enter your email address'}
                style={inputStyle('email')}
              />
            </IconInput>
            <ErrLabel field="email" />
          </div>

          {/* ── Phone + Password ── */}
          <div className="form-row" style={{ marginBottom: '0.85rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#374151', marginBottom: 5 }}>
                {lang === 'am' ? 'ስልክ ቁጥር' : 'Phone Number'}
              </label>
              <IconInput icon="fi-rr-phone-call" error={touched.phone && errs.phone}>
                <input
                  type="tel" name="reg-phone" autoComplete="new-password"
                  value={form.phone} onChange={set('phone')} onBlur={() => touch('phone')}
                  placeholder={lang === 'am' ? 'ስልክ ቁጥርዎን ያስገቡ' : 'Enter your phone number'}
                  style={inputStyle('phone')}
                />
              </IconInput>
              <ErrLabel field="phone" />
            </div>
            <div>
              {form.role !== 'owner' ? (
                <>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#374151', marginBottom: 5 }}>
                    {lang === 'am' ? 'የሂሳብ ቁጥር' : 'Account Number'} <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <IconInput icon="fi-rr-hashtag" error={touched.accountNumber && errs.accountNumber}>
                    <input
                      type="text" name="reg-account" autoComplete="new-password"
                      value={form.accountNumber} onChange={set('accountNumber')} onBlur={() => touch('accountNumber')}
                      placeholder={lang === 'am' ? 'የሂሳብ ቁጥርዎን ያስገቡ' : 'Enter your account number'}
                      style={inputStyle('accountNumber')}
                    />
                  </IconInput>
                  <ErrLabel field="accountNumber" />
                </>
              ) : (
                <div style={{ height: '100%' }} />
              )}
            </div>
          </div>

          {/* ── Password + Confirm Password ── */}
          <div className="form-row" style={{ marginBottom: '0.85rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#374151', marginBottom: 5 }}>
                {lang === 'am' ? 'የይለፍ ቃል' : 'Password'} <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <i className="fi fi-rr-lock" style={{
                  position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                  color: touched.password && errs.password ? '#ef4444' : '#9ca3af',
                  fontSize: '0.95rem', pointerEvents: 'none',
                }} />
                <input
                  type={showPw ? 'text' : 'password'} name="reg-password" autoComplete="new-password"
                  value={form.password} onChange={set('password')} onBlur={() => touch('password')}
                  placeholder={lang === 'am' ? 'የይለፍ ቃል ፍጠር' : 'Create a password'}
                  style={pwInputStyle('password')}
                />
                <button type="button" onClick={() => setShowPw(p => !p)} tabIndex={-1}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '1rem' }}>
                  <i className={`fi ${showPw ? 'fi-rr-eye-crossed' : 'fi-rr-eye'}`} />
                </button>
              </div>
              <ErrLabel field="password" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#374151', marginBottom: 5 }}>
                {lang === 'am' ? 'የይለፍ ቃሉን ያረጋግጡ' : 'Confirm Password'} <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <i className="fi fi-rr-lock" style={{
                  position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                  color: touched.confirmPassword && errs.confirmPassword ? '#ef4444' : '#9ca3af',
                  fontSize: '0.95rem', pointerEvents: 'none',
                }} />
                <input
                  type={showConfirm ? 'text' : 'password'} name="reg-confirm" autoComplete="new-password"
                  value={form.confirmPassword} onChange={set('confirmPassword')} onBlur={() => touch('confirmPassword')}
                  placeholder={lang === 'am' ? 'የይለፍ ቃልዎን ያረጋግጡ' : 'Confirm your password'}
                  style={pwInputStyle('confirmPassword')}
                />
                <button type="button" onClick={() => setShowConfirm(p => !p)} tabIndex={-1}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '1rem' }}>
                  <i className={`fi ${showConfirm ? 'fi-rr-eye-crossed' : 'fi-rr-eye'}`} />
                </button>
              </div>
              <ErrLabel field="confirmPassword" />
            </div>
          </div>

          {/* ── Farm Name + Location — visible only for Farm Owner ── */}
          {form.role === 'owner' && (
            <div className="form-row" style={{ marginBottom: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#374151', marginBottom: 5 }}>
                  {lang === 'am' ? 'የእርሻ ስም' : 'Farm Name'} <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <IconInput icon="fi-rr-seedling" error={touched.farmName && errs.farmName}>
                  <input
                    type="text" name="reg-farmname" autoComplete="new-password"
                    value={form.farmName} onChange={set('farmName')} onBlur={() => touch('farmName')}
                    placeholder={lang === 'am' ? 'የእርሻ ስምዎን ያስገቡ' : 'Enter your farm name'}
                    style={inputStyle('farmName')}
                  />
                </IconInput>
                <ErrLabel field="farmName" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#374151', marginBottom: 5 }}>
                  {lang === 'am' ? 'አካባቢ' : 'Location'} <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <IconInput icon="fi-rr-marker" error={touched.location && errs.location}>
                  <input
                    type="text" name="reg-location" autoComplete="new-password"
                    value={form.location} onChange={set('location')} onBlur={() => touch('location')}
                    placeholder={lang === 'am' ? 'አካባቢዎን ያስገቡ' : 'e.g. Bahir Dar'}
                    style={inputStyle('location')}
                  />
                </IconInput>
                <ErrLabel field="location" />
              </div>
            </div>
          )}

          {/* ── Terms checkbox ── */}
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: '0.82rem', color: '#374151', lineHeight: 1.5 }}>
              <input
                type="checkbox"
                checked={agreed}
                onChange={e => { setAgreed(e.target.checked); setError(''); }}
                onBlur={() => touch('agreed')}
                style={{ marginTop: 2, width: 15, height: 15, accentColor: '#166534', flexShrink: 0, cursor: 'pointer' }}
              />
              <span>
                {lang === 'am' ? 'ከ' : 'I agree to the'}{' '}
                <span style={{ color: '#166534', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>
                  {lang === 'am' ? 'አጠቃቀም ደንቦች' : 'Terms & Conditions'}
                </span>{' '}
                {lang === 'am' ? 'እና' : 'and'}{' '}
                <span style={{ color: '#166534', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>
                  {lang === 'am' ? 'የግላዊነት ፖሊሲ' : 'Privacy Policy'}
                </span>
              </span>
            </label>
            {touched.agreed && errs.agreed && (
              <span style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                <i className="fi fi-rr-cross-circle" />{errs.agreed}
              </span>
            )}
          </div>

          {/* ── Submit button ── */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.85rem',
              background: loading ? '#6b7280' : 'linear-gradient(135deg, #166534 0%, #15803d 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontSize: '1rem',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 4px 16px rgba(22,101,52,0.3)',
              transition: 'opacity 0.15s',
            }}
          >
            {loading
              ? <><i className="fi fi-rr-spinner" />{lang === 'am' ? 'በመፍጠር ላይ…' : 'Creating account…'}</>
              : <><i className="fi fi-rr-user-add" />{lang === 'am' ? 'አካውንት ፍጠር' : 'Create Account'}</>
            }
          </button>
          {loading && wakeMessage && (
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

        {/* ── Sign in link ── */}
        {!pending && (
          <p style={{ textAlign: 'center', marginTop: '1.2rem', fontSize: '0.85rem', color: '#6b7280' }}>
            {lang === 'am' ? 'አካውንት አለዎት?' : 'Already have an account?'}{' '}
            <Link to="/login" style={{ color: '#166534', fontWeight: 700, textDecoration: 'none' }}>
              {lang === 'am' ? 'ወደ ስርዓቱ ይግቡ' : 'Sign in'}
            </Link>
          </p>
        )}
      </div>

    </div>
  );
}
