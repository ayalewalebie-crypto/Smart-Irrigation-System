import { Link, useNavigate } from 'react-router-dom';
import { useLang } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import logoImg from '../assets/logo.jpg';
import bgImg   from '../assets/bg.jpg';

const FEATURES = [
  { icon: 'fi fi-rr-signal-alt',      title: 'Real-Time Sensor Data',    desc: 'Live soil moisture, temperature, humidity, pH and water level readings from Arduino Uno & ESP8266 nodes.' },
  { icon: 'fi fi-rr-tint',            title: 'Automated Irrigation',     desc: 'Smart farm-based watering triggered automatically when moisture drops below your configured threshold.' },
  { icon: 'fi fi-rr-chart-histogram', title: 'Reports & Analytics',      desc: 'Daily water usage charts, sensor logs, irrigation events and exportable CSV reports.' },
  { icon: 'fi fi-rr-crown',           title: '4-Role Access Control',    desc: 'Separate dashboards for Farm Owner, Admin, Office Manager, and Laborer with full RBAC.' },
  { icon: 'fi fi-rr-calendar',        title: 'Irrigation Scheduling',    desc: 'Configure automated schedules per farm — set timing, duration and auto/manual mode.' },
  { icon: 'fi fi-rr-globe',           title: 'Bilingual Interface',      desc: 'Full support for English and Amharic (አማርኛ) throughout the entire application.' },
  { icon: 'fi fi-rr-clipboard-list',  title: 'Task Management',          desc: 'Assign field tasks to laborers, track Pending → In Progress → Completed and collect work reports.' },
  { icon: 'fi fi-rr-bell-ring',       title: 'Alerts & Notifications',   desc: 'Instant alerts for offline sensors, low moisture, high temperature, low water level and pH anomalies.' },
];

const ROLES = [
  { icon: 'fi fi-rr-crown',         role: 'Farm Owner',     color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', en: 'Highest authority — manage all farms, users, reports, financial data and approve major decisions.', am: 'ከፍተኛ ስልጣን — ሁሉንም እርሻዎች፣ ሪፖርቶች፣ ሂሳቦች እና ስርዓት አፈጻጸምን ይቆጣጠሩ' },
  { icon: 'fi fi-rr-shield-check',  role: 'Admin',          color: '#dc2626', bg: '#fff1f2', border: '#fecaca', en: 'Manage farms, sensors, irrigation devices, schedules, alerts and assign tasks to laborers.', am: 'እርሻዎችን፣ ሴንሰሮችን፣ የመስኖ ፕሮግራሞችን እና ማስጠንቀቂያዎችን ያስተዳድሩ' },
  { icon: 'fi fi-rr-briefcase',     role: 'Office Manager', color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc', en: 'Manage employee records, work schedules, attendance, payroll and administrative reports.', am: 'የሰራተኞች መዝገቦች፣ የስራ ፕሮግራሞች እና አስተዳደራዊ ሪፖርቶችን ያስተዳድሩ' },
  { icon: 'fi fi-rr-helmet-safety', role: 'Laborer',        color: '#2563eb', bg: '#eff6ff', border: '#93c5fd', en: 'View assigned tasks, update task status and submit work completion reports.', am: 'የተመደቡ ተግባሮችን ይፈትሹ፣ ሁኔታ ያዘምኑ እና የስራ ሪፖርቶች ያስገቡ' },
];

const STEPS = [
  { step: '01', icon: 'fi fi-rr-sensor-on',   en: { title: 'Connect Sensors',     desc: 'Connect Arduino Uno & ESP8266 sensor nodes to your farm zones — moisture, temp, pH, water level.' } },
  { step: '02', icon: 'fi fi-rr-dashboard',   en: { title: 'Monitor Live Data',   desc: 'View real-time sensor readings on your role-specific dashboard — alerts trigger automatically.' } },
  { step: '03', icon: 'fi fi-rr-tint',        en: { title: 'Automate Irrigation', desc: 'The system irrigates automatically when readings drop below your configured thresholds.' } },
];

const STATS = [
  { val: '4',    en: 'User Roles',       am: 'የተጠቃሚ ሚናዎች' },
  { val: '8+',   en: 'Sensor Types',     am: 'ሴንሰር ዓይነቶች' },
  { val: '24/7', en: 'Live Monitoring',  am: 'ቀጥታ ክትትል' },
  { val: '2',    en: 'Languages',        am: 'ቋንቋዎች' },
];

export default function LandingPage() {
  const { lang, switchLang } = useLang();
  const { user, logout }     = useAuth();
  const navigate             = useNavigate();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Segoe UI, system-ui, sans-serif', color: '#1a2e1a' }}>

      {/* ── NAVBAR ───────────────────────────────────────────────────── */}
      <nav style={{ background: 'linear-gradient(90deg,#14532d 0%,#166534 60%,#15803d 100%)', padding: '0 2rem', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 200, boxShadow: '0 2px 16px rgba(0,0,0,0.28)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src={logoImg} alt="logo" style={{ width: 46, height: 46, borderRadius: 10, objectFit: 'contain', background: '#fff', padding: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }} />
          <span style={{ fontWeight: 800, fontSize: '1rem', color: '#fff' }}>
            {lang === 'am' ? 'ዘመናዊ መስኖ ስርዓት' : 'Smart Irrigation System'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.12)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.25)', overflow: 'hidden' }}>
            <button onClick={() => switchLang('en')} style={{ padding: '5px 14px', fontSize: '0.75rem', fontWeight: 600, background: lang === 'en' ? 'rgba(255,255,255,0.9)' : 'transparent', color: lang === 'en' ? '#166534' : '#fff', border: 'none', cursor: 'pointer' }}>EN</button>
            <button onClick={() => switchLang('am')} style={{ padding: '5px 14px', fontSize: '0.75rem', fontWeight: 600, background: lang === 'am' ? 'rgba(255,255,255,0.9)' : 'transparent', color: lang === 'am' ? '#166534' : '#fff', border: 'none', cursor: 'pointer' }}>አማ</button>
          </div>
          {user ? (
            <>
              <span style={{ fontSize: '0.82rem', color: '#bbf7d0' }}><i className="fi fi-rr-hand-wave" style={{ marginRight: 4 }} />{user.name}</span>
              <button onClick={() => navigate('/home')} style={{ padding: '7px 20px', borderRadius: 8, background: '#fff', color: '#166534', fontWeight: 700, fontSize: '0.87rem', border: 'none', cursor: 'pointer' }}>{lang === 'am' ? 'ዳሽቦርድ' : 'Dashboard'}</button>
              <button onClick={() => { logout(); navigate('/'); }} style={{ padding: '7px 16px', borderRadius: 8, border: '2px solid rgba(255,255,255,0.5)', background: 'transparent', color: '#fff', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>{lang === 'am' ? 'ውጣ' : 'Logout'}</button>
            </>
          ) : (
            <Link to="/login" style={{ padding: '7px 22px', borderRadius: 8, background: '#fff', color: '#166534', fontWeight: 700, fontSize: '0.87rem', textDecoration: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>{lang === 'am' ? 'ግባ' : 'Login'}</Link>
          )}
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section style={{ backgroundImage: `url(${bgImg})`, backgroundSize: 'cover', backgroundPosition: 'center', padding: '6rem 1.5rem 5rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg,rgba(8,35,12,0.8) 0%,rgba(20,83,45,0.72) 50%,rgba(21,128,61,0.65) 100%)', zIndex: 0 }} />
        <div style={{ position: 'relative', zIndex: 1, marginBottom: '1.8rem' }}>
          <img src={logoImg} alt="logo" style={{ width: 140, height: 140, borderRadius: 20, objectFit: 'contain', background: '#fff', padding: 8, boxShadow: '0 12px 48px rgba(0,0,0,0.38)' }} />
        </div>
        <h1 style={{ position: 'relative', zIndex: 1, fontSize: 'clamp(2rem,5.5vw,3.4rem)', fontWeight: 900, color: '#fff', lineHeight: 1.15, margin: '0 0 1.2rem', maxWidth: 780, marginLeft: 'auto', marginRight: 'auto', textShadow: '0 2px 16px rgba(0,0,0,0.45)' }}>
          {lang === 'am' ? 'እንኳን ወደ ዘመናዊ የመስኖ ስርዓት ደህና መጡ' : 'Smart Irrigation System'}
        </h1>
        <p style={{ position: 'relative', zIndex: 1, fontSize: '1.08rem', color: '#bbf7d0', lineHeight: 1.85, maxWidth: 660, margin: '0 auto 0.8rem', opacity: 0.95 }}>
          {lang === 'am'
            ? 'Arduino Uno እና ESP8266 ሴንሰሮችን ከዘመናዊ ድር ፕላትፎርም ጋር በማዋሃድ ለኢትዮጵያ አርሶ አደሮች ብልሃተኛ የውሃ አስተዳደር።'
            : 'Intelligent water management for Ethiopian farmers — IoT sensors integrated with a full-stack platform for real-time monitoring, automated irrigation and multi-role farm management.'}
        </p>
        <p style={{ position: 'relative', zIndex: 1, fontSize: '0.87rem', color: '#86efac', margin: '0 0 2.8rem', opacity: 0.9 }}>
          <i className="fi fi-rr-marker" style={{ marginRight: 6 }} />{lang === 'am' ? 'ባህር ዳር ዩኒቨርሲቲ · አማራ ክልል · ኢትዮጵያ' : 'Bahir Dar University · Amhara Region · Ethiopia'}
        </p>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/login" style={{ padding: '0.95rem 2.6rem', background: '#fff', color: '#166534', borderRadius: 12, fontWeight: 800, fontSize: '1.05rem', textDecoration: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.28)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <i className="fi fi-rr-sign-in-alt" />{lang === 'am' ? 'ወደ ስርዓቱ ይግቡ' : 'Sign In'}
          </Link>
          <Link to="/register" style={{ padding: '0.95rem 2.4rem', background: 'rgba(255,255,255,0.14)', color: '#fff', borderRadius: 12, fontWeight: 700, fontSize: '1.05rem', textDecoration: 'none', border: '2px solid rgba(255,255,255,0.55)', backdropFilter: 'blur(4px)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <i className="fi fi-rr-user-add" />{lang === 'am' ? 'አዲስ አካውንት ፍጠር' : 'Create Account'}
          </Link>
        </div>
        <div style={{ position: 'relative', zIndex: 1, marginTop: '3rem', opacity: 0.45, fontSize: '0.78rem', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <span>{lang === 'am' ? 'ተሸብልሎ ይመልከቱ' : 'Scroll to explore'}</span>
          <i className="fi fi-rr-angle-double-down" />
        </div>
      </section>

      {/* ── STATS STRIP ──────────────────────────────────────────────── */}
      <section style={{ background: '#14532d', padding: '1.8rem 2rem', display: 'flex', justifyContent: 'center', gap: '3rem', flexWrap: 'wrap' }}>
        {STATS.map(s => (
          <div key={s.en} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#86efac', lineHeight: 1 }}>{s.val}</div>
            <div style={{ fontSize: '0.79rem', color: '#bbf7d0', opacity: 0.8, marginTop: 4 }}>{lang === 'am' ? s.am : s.en}</div>
          </div>
        ))}
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────── */}
      <section style={{ padding: '4.5rem 2rem', background: '#fff' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.8rem' }}>
            <span style={{ background: '#dcfce7', color: '#166534', borderRadius: 20, padding: '4px 14px', fontSize: '0.78rem', fontWeight: 700, letterSpacing: 1 }}>{lang === 'am' ? 'ባህሪያት' : 'FEATURES'}</span>
            <h2 style={{ fontSize: 'clamp(1.5rem,3vw,2rem)', fontWeight: 800, color: '#14532d', margin: '0.7rem 0 0.4rem' }}>{lang === 'am' ? 'ዋና ባህሪያት' : 'Everything Your Farm Needs'}</h2>
            <p style={{ color: '#6b7280', fontSize: '0.92rem', maxWidth: 520, margin: '0 auto' }}>{lang === 'am' ? 'ሙሉ የእርሻ ቁጥጥር ስርዓት' : 'A complete smart irrigation platform built for Ethiopian agriculture'}</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: '1.2rem' }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{ background: 'linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%)', borderRadius: 16, padding: '1.4rem', border: '1px solid #bbf7d0', display: 'flex', gap: 14, alignItems: 'flex-start', boxShadow: '0 2px 8px rgba(22,101,52,0.07)', transition: 'transform 0.2s,box-shadow 0.2s', cursor: 'default' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 10px 28px rgba(22,101,52,0.15)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(22,101,52,0.07)'; }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px rgba(22,101,52,0.3)' }}>
                  <i className={f.icon} style={{ color: '#fff', fontSize: '1.2rem' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#14532d', marginBottom: 5 }}>{f.title}</div>
                  <div style={{ fontSize: '0.81rem', color: '#4b7a57', lineHeight: 1.65 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────── */}
      <section style={{ padding: '4.5rem 2rem', background: 'linear-gradient(180deg,#f0fdf4 0%,#fff 100%)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <span style={{ background: '#dcfce7', color: '#166534', borderRadius: 20, padding: '4px 14px', fontSize: '0.78rem', fontWeight: 700, letterSpacing: 1 }}>{lang === 'am' ? 'እንዴት ይሰራል' : 'HOW IT WORKS'}</span>
          <h2 style={{ fontSize: 'clamp(1.4rem,3vw,1.9rem)', fontWeight: 800, color: '#14532d', margin: '0.7rem 0 2.5rem' }}>{lang === 'am' ? 'ሶስት ቀላል ደረጃዎች' : 'Three Simple Steps'}</h2>
          <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {STEPS.map((s, i) => (
              <div key={s.step} style={{ flex: 1, minWidth: 220, maxWidth: 265, background: '#fff', borderRadius: 18, padding: '2rem 1.5rem', boxShadow: '0 4px 20px rgba(22,101,52,0.1)', border: '1px solid #dcfce7', position: 'relative' }}>
                {i < 2 && <div style={{ position: 'absolute', top: 28, right: -20, color: '#86efac', fontSize: '1.3rem', zIndex: 1 }}><i className="fi fi-rr-arrow-right" /></div>}
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', boxShadow: '0 4px 14px rgba(22,101,52,0.3)' }}>
                  <i className={s.icon} style={{ color: '#fff', fontSize: '1.3rem' }} />
                </div>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#86efac', letterSpacing: 2, marginBottom: 6 }}>{s.step}</div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: '#14532d', marginBottom: 8 }}>{s.en.title}</div>
                <div style={{ fontSize: '0.82rem', color: '#4b7a57', lineHeight: 1.65 }}>{s.en.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ROLES ────────────────────────────────────────────────────── */}
      <section style={{ padding: '4.5rem 2rem', background: '#fff' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.8rem' }}>
            <span style={{ background: '#dcfce7', color: '#166534', borderRadius: 20, padding: '4px 14px', fontSize: '0.78rem', fontWeight: 700, letterSpacing: 1 }}>{lang === 'am' ? 'ሚናዎች' : 'USER ROLES'}</span>
            <h2 style={{ fontSize: 'clamp(1.4rem,3vw,1.9rem)', fontWeight: 800, color: '#14532d', margin: '0.7rem 0 0.4rem' }}>{lang === 'am' ? 'አራት ሚናዎች' : 'Four Dedicated Roles'}</h2>
            <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>{lang === 'am' ? 'ሚናዎ ላይ ተመስርቶ ተዛማጅ ዳሽቦርድ ያያሉ' : 'Each role gets a tailored dashboard with exactly the tools they need'}</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {ROLES.map(r => (
              <div key={r.role} style={{ background: r.bg, border: `2px solid ${r.border}`, borderRadius: 18, padding: '1.8rem 1.3rem', textAlign: 'center', flex: 1, minWidth: 175, maxWidth: 210, boxShadow: '0 4px 16px rgba(0,0,0,0.06)', transition: 'transform 0.2s,box-shadow 0.2s', cursor: 'default' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = `0 14px 36px ${r.color}30`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)'; }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: r.color, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', boxShadow: `0 4px 16px ${r.color}44` }}>
                  <i className={r.icon} style={{ color: '#fff', fontSize: '1.4rem' }} />
                </div>
                <div style={{ fontWeight: 800, fontSize: '1rem', color: r.color, marginBottom: 8 }}>{r.role}</div>
                <div style={{ fontSize: '0.79rem', color: '#4b5563', lineHeight: 1.65 }}>{lang === 'am' ? r.am : r.en}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ───────────────────────────────────────────────── */}
      <section style={{ background: 'linear-gradient(135deg,#14532d 0%,#166534 50%,#15803d 100%)', padding: '4rem 2rem', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(1.5rem,3.5vw,2.2rem)', fontWeight: 900, color: '#fff', margin: '0 0 1rem', textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>
          {lang === 'am' ? 'ዛሬ ይጀምሩ' : 'Ready to Get Started?'}
        </h2>
        <p style={{ color: '#bbf7d0', fontSize: '1rem', marginBottom: '2rem', opacity: 0.9, maxWidth: 480, margin: '0 auto 2rem' }}>
          {lang === 'am' ? 'አካውንት ይፍጠሩ እና ዘመናዊ መስኖ ቁጥጥርን ያስጀምሩ' : 'Create your Owner account and start managing your farm smarter today.'}
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/register" style={{ padding: '0.95rem 2.6rem', background: '#fff', color: '#166534', borderRadius: 12, fontWeight: 800, fontSize: '1.05rem', textDecoration: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.28)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <i className="fi fi-rr-user-add" />{lang === 'am' ? 'አዲስ አካውንት ፍጠር' : 'Create Owner Account'}
          </Link>
          <Link to="/login" style={{ padding: '0.95rem 2.4rem', background: 'rgba(255,255,255,0.14)', color: '#fff', borderRadius: 12, fontWeight: 700, fontSize: '1.05rem', textDecoration: 'none', border: '2px solid rgba(255,255,255,0.55)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <i className="fi fi-rr-sign-in-alt" />{lang === 'am' ? 'ወደ ስርዓቱ ይግቡ' : 'Sign In'}
          </Link>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────── */}
      <footer style={{ background: '#0a2010', color: '#c8e6c9', padding: '3rem 2rem 1.8rem', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginBottom: '1.2rem' }}>
          <img src={logoImg} alt="logo" style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'contain', background: '#fff', padding: 3 }} />
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#fff' }}>{lang === 'am' ? 'ዘመናዊ መስኖ ስርዓት' : 'Smart Irrigation System'}</div>
            <div style={{ fontSize: '0.74rem', color: '#86efac', opacity: 0.8 }}>{lang === 'am' ? 'ብልሃተኛ የእርሻ ውሃ አስተዳደር' : 'Intelligent Farm Water Management'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '3.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#86efac', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Contact</div>
            <div style={{ fontSize: '0.81rem', color: '#c8e6c9', opacity: 0.7, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span><i className="fi fi-rr-envelope" style={{ marginRight: 5 }} />ayalewalebie@gmail.com</span>
              <span><i className="fi fi-rr-mobile"   style={{ marginRight: 5 }} />+251 933 834 900</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#86efac', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Location</div>
            <div style={{ fontSize: '0.81rem', color: '#c8e6c9', opacity: 0.7, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span><i className="fi fi-rr-graduation-cap" style={{ marginRight: 5 }} />Bahir Dar University</span>
              <span><i className="fi fi-rr-marker"          style={{ marginRight: 5 }} />Amhara Region, Ethiopia</span>
            </div>
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
          <p style={{ fontSize: '0.71rem', color: '#c8e6c9', opacity: 0.4, margin: 0 }}>
            © {new Date().getFullYear()} Smart Irrigation System · Developed by Alebie Ayalew &amp; Belayneh Shiferaw · Bahir Dar University
          </p>
        </div>
      </footer>
    </div>
  );
}
