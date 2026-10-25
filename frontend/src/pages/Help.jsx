/**
 * Help Page — available to ALL 4 roles
 * Covers:
 *  - FAQs (general, sensor/device, irrigation, role-specific)
 *  - System guidance
 *  - Sensor & device guidance
 *  - Irrigation instructions
 *  - Support contact form
 */
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';

// ── FAQ data ──────────────────────────────────────────────────────────────────
const FAQ_SECTIONS = [
  {
    section: 'General',
    icon: 'fi-rr-info',
    color: '#3b82f6',
    faqs: [
      { q: 'How do I sign in to the system?',                a: 'Go to the login page, enter your registered email address and password, then click "Sign In". After login you will be taken to your role-specific dashboard.' },
      { q: 'How do I change the interface language?',        a: 'Go to Settings → General → select English or አማርኛ (Amharic) under Interface Language.' },
      { q: 'How do I update my profile information?',        a: 'Click your name or avatar in the top-right corner, then select Profile → Edit Profile. You can update your name, phone number, farm name, and location.' },
      { q: 'How do I change my password?',                   a: 'Go to Profile → Change Password. Enter your current password, then enter and confirm your new password. Your new password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.' },
      { q: 'What do I do if I forget my password?',          a: 'Contact the Farm Owner or Admin to reset your account password. They can assign you a new temporary password from User Management.' },
      { q: 'Can I use the system on my phone?',              a: 'Yes — the dashboard is fully responsive and works on smartphones, tablets, and desktop computers.' },
    ],
  },
  {
    section: 'Sensors & Devices',
    icon: 'fi-rr-signal-alt',
    color: '#22c55e',
    faqs: [
      { q: 'What hardware does this system support?',        a: 'The system supports Arduino Uno and ESP8266-based IoT nodes. Each node sends soil moisture, temperature, humidity, water level, pH, flow rate, pump status, and relay state to the backend via HTTP REST.' },
      { q: 'Why is a sensor showing as Offline?',            a: 'Check the ESP8266/Arduino power supply and WiFi connection. Ensure the device firmware has the correct backend URL and API key configured. The device must POST readings to /api/sensors/:id/reading every 10–30 seconds to stay Online.' },
      { q: 'What is the optimal soil moisture range?',       a: 'For most Ethiopian crops (teff, wheat, maize) the optimal moisture range is 40–70%. The system triggers an alert when moisture drops below the threshold set in Settings (default: 30%).' },
      { q: 'What does the pH sensor measure?',               a: 'The pH sensor measures soil acidity/alkalinity on a 0–14 scale. 7 is neutral. Most crops grow best between pH 5.5–7.5. The system shows a warning if pH falls outside this range.' },
      { q: 'How do I send a message to the LCD screen?',     a: 'Go to Sensors & Devices → click on a device to expand it → scroll to "Send to LCD" → type your message (max 64 characters) → click Send. The message will appear on the device LCD.' },
      { q: 'How do I add a new device?',                     a: 'Configure the Arduino/ESP8266 firmware with the server URL and device ID, then power it on. It will appear in the Sensors & Devices list once it sends its first reading.' },
      { q: 'What is the Siren control?',                     a: 'The siren triggers an audible alarm on the device. Go to Sensors & Devices → expand a device → Siren Control → Turn Siren ON/OFF. Useful for alerting farm workers on-site.' },
    ],
  },
  {
    section: 'Irrigation',
    icon: 'fi-rr-tint',
    color: '#0891b2',
    faqs: [
      { q: 'How do I start irrigation for a single farm?',   a: 'Go to Farm Management → find the farm zone → click the toggle switch or the "Irrigate" button. The pump relay will activate immediately.' },
      { q: 'How do I irrigate all farms at once?',           a: 'Go to Farm Management (or the Dashboard) → click "Irrigate All Zones". All configured farms will start irrigating simultaneously.' },
      { q: 'How does Auto Mode work?',                       a: 'When Auto Mode is enabled in Farm Management or Settings, the system will automatically start irrigation when soil moisture drops below the configured threshold (default: 30%). It stops when moisture reaches the upper threshold or the set duration expires.' },
      { q: 'How do I set an irrigation schedule?',           a: 'Go to Irrigation Control → click "Add Schedule" → select the farm, day, start time, and duration → save. The system will activate irrigation automatically at the scheduled time.' },
      { q: 'How do I stop irrigation immediately?',          a: 'Go to Farm Management → click "Stop" on the specific farm, or click "Stop All" to stop all active zones at once.' },
      { q: 'What is the relay module?',                      a: 'The relay module is an electrical switch controlled by the ESP8266. When the system starts irrigation, it sends a signal to close the relay, which activates the water pump. Relay status (ON/OFF) is displayed on the sensor card.' },
      { q: 'How much water does each irrigation session use?', a: 'Water usage (litres) is logged per session and displayed on the Dashboard and in the Water Usage Report. Each session uses water proportional to duration and pump flow rate.' },
    ],
  },
  {
    section: 'Roles & Access',
    icon: 'fi-rr-users-alt',
    color: '#7c3aed',
    faqs: [
      { q: 'What can a Farm Owner do?',                      a: 'The Farm Owner has the highest authority. They can manage farms, control irrigation, monitor all sensors, manage employees, handle finances (budget, payroll, expenses, income), view all reports, and manage all user accounts.' },
      { q: 'What can an Admin do?',                          a: 'The Admin manages the software system — user accounts, devices, farms, irrigation schedules, and system configuration. The Admin does not have access to financial data (payroll, budget, income).' },
      { q: 'What can an Office Manager do?',                 a: 'The Office Manager handles daily farm operations — employee HR records, attendance tracking, payroll preparation, expense recording, task assignment, and work schedules.' },
      { q: 'What can a Laborer do?',                         a: 'The Laborer can view their assigned tasks, update task status (Pending → In Progress → Completed), view their assigned farm, check attendance records, and receive notifications. They cannot access financial or user management features.' },
      { q: 'Can a user change their own role?',              a: 'No. Only the Farm Owner can change a user\'s role from User Management. Users cannot assign themselves a higher role.' },
      { q: 'How are new users added to the system?',         a: 'Users can self-register on the Sign Up page by selecting their role. All accounts are activated immediately. The Farm Owner can also create accounts directly from User Management with a temporary password.' },
    ],
  },
  {
    section: 'Reports & Data',
    icon: 'fi-rr-chart-histogram',
    color: '#f59e0b',
    faqs: [
      { q: 'How do I export a report?',                      a: 'Go to Reports → select the report type and date range → click "Export CSV" or "Export JSON" to download the data to your computer.' },
      { q: 'How far back does the history go?',              a: 'The system logs all events indefinitely in MongoDB. Use the History page date filters to search specific date ranges.' },
      { q: 'Can I view sensor data over time?',              a: 'Yes — go to Reports → Sensor Logs, select a date range and click Generate. This shows all sensor readings logged during that period.' },
      { q: 'What is the Activity Log?',                      a: 'The Activity Log (History page) records every significant system event — irrigation start/stop, user logins, task updates, device alerts, and financial transactions.' },
    ],
  },
];

const QUICK_LINKS = [
  { icon: 'fi-rr-seedling',     label: 'Farm Control',       path: '/farm-control' },
  { icon: 'fi-rr-signal-alt',   label: 'Sensors & Devices',  path: '/sensors' },
  { icon: 'fi-rr-tint',         label: 'Irrigation Control', path: '/irrigation-schedule' },
  { icon: 'fi-rr-clipboard-list',label: 'Tasks',             path: '/tasks' },
  { icon: 'fi-rr-bell',         label: 'Notifications',      path: '/notifications' },
  { icon: 'fi-rr-settings',     label: 'Settings',           path: '/settings' },
];

export default function Help() {
  const { t }        = useLang();
  const { user, can }= useAuth();
  const [openFaq,  setOpenFaq]  = useState(null);
  const [openSec,  setOpenSec]  = useState('General');
  const [form,     setForm]     = useState({ subject: '', message: '' });
  const [sent,     setSent]     = useState(false);

  const send = (e) => {
    e.preventDefault();
    setSent(true);
    setForm({ subject: '', message: '' });
    setTimeout(() => setSent(false), 3000);
  };

  const faqKey = (sec, i) => `${sec}-${i}`;

  return (
    <div>
      <div className="page-header">
        <h1><i className="fi fi-rr-interrogation" style={{ marginRight: 8 }} />Help &amp; Support</h1>
        <div className="header-actions">
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: '#f3f4f6', padding: '4px 12px', borderRadius: 20 }}>
            <i className="fi fi-rr-user" style={{ marginRight: 5 }} />
            Logged in as: <strong>{user?.name}</strong>
          </span>
        </div>
      </div>

      <div className="grid-2">
        {/* ── Left: FAQs ─────────────────────────────────────────────────── */}
        <div>
          {/* Section tabs */}
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            {FAQ_SECTIONS.map(s => (
              <button key={s.section} onClick={() => setOpenSec(s.section)}
                className={`btn btn-sm ${openSec === s.section ? 'btn-primary' : 'btn-outline'}`}
                style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <i className={`fi ${s.icon}`} />{s.section}
              </button>
            ))}
          </div>

          {FAQ_SECTIONS.filter(s => s.section === openSec).map(section => (
            <div key={section.section} className="card">
              <div className="card-header">
                <span className="card-title" style={{ color: section.color }}>
                  <i className={`fi ${section.icon}`} style={{ marginRight: 6 }} />{section.section} FAQs
                </span>
                <span style={{ fontSize: '0.72rem', background: `${section.color}18`, color: section.color, borderRadius: 20, padding: '2px 10px', fontWeight: 700 }}>
                  {section.faqs.length} questions
                </span>
              </div>
              {section.faqs.map((faq, i) => {
                const key     = faqKey(section.section, i);
                const isOpen  = openFaq === key;
                return (
                  <div key={i} style={{ borderBottom: i < section.faqs.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : key)}
                      style={{ width: '100%', background: 'none', border: 'none', padding: '0.75rem 0', textAlign: 'left', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text)', gap: 8 }}>
                      <span style={{ flex: 1 }}>{faq.q}</span>
                      <i className={`fi ${isOpen ? 'fi-rr-angle-up' : 'fi-rr-angle-down'}`} style={{ color: section.color, flexShrink: 0 }} />
                    </button>
                    {isOpen && (
                      <div style={{ padding: '0 0 0.8rem', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.7, borderLeft: `3px solid ${section.color}`, paddingLeft: '0.8rem', marginBottom: '0.3rem' }}>
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Quick navigation */}
          <div className="card" style={{ marginTop: '1rem' }}>
            <div className="card-header">
              <span className="card-title"><i className="fi fi-rr-rocket" style={{ marginRight: 6 }} />Quick Navigation</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px,1fr))', gap: '0.5rem' }}>
              {QUICK_LINKS.filter(l => can(l.path.replace('/', '').replace('-', ''))).concat(
                QUICK_LINKS.filter(l => !can(l.path.replace('/', '').replace('-', '')))
              ).slice(0, 6).map(({ icon, label, path }) => (
                <a key={label} href={path} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.6rem 0.8rem', borderRadius: 8, background: 'var(--primary-light)', color: 'var(--primary-dark)', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--primary)' && (e.currentTarget.style.color = '#fff')}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--primary-light)'; e.currentTarget.style.color = 'var(--primary-dark)'; }}>
                  <i className={`fi ${icon}`} style={{ flexShrink: 0 }} />{label}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: Guidance + Contact ────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* System guidance card */}
          <div className="card">
            <div className="card-header">
              <span className="card-title"><i className="fi fi-rr-book" style={{ marginRight: 6 }} />System Overview</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem' }}>
              {[
                { icon: 'fi-rr-crown',        color: '#7c3aed', title: 'Farm Owner',      desc: 'Manages the entire farm. Controls irrigation, monitors sensors, manages finances, employees, tasks, and all user accounts.' },
                { icon: 'fi-rr-shield-check', color: '#ef4444', title: 'Admin',            desc: 'Manages the system software — user accounts, device configuration, farm zones, irrigation schedules, and system settings.' },
                { icon: 'fi-rr-briefcase',    color: '#0891b2', title: 'Office Manager',   desc: 'Manages daily operations — employee records, attendance, payroll preparation, expenses, and work schedules.' },
                { icon: 'fi-rr-helmet-safety',color: '#2563eb', title: 'Laborer',          desc: 'Views assigned tasks, updates progress (Pending → In Progress → Completed), views assigned farm, and tracks attendance.' },
              ].map(r => (
                <div key={r.title} style={{ display: 'flex', gap: 10, padding: '0.55rem', background: `${r.color}08`, borderRadius: 8, border: `1px solid ${r.color}22` }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${r.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className={`fi ${r.icon}`} style={{ color: r.color }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.83rem', color: r.color }}>{r.title}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5, marginTop: 2 }}>{r.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Contact support form */}
          <div className="card">
            <div className="card-header">
              <span className="card-title"><i className="fi fi-rr-envelope" style={{ marginRight: 6 }} />Contact Support</span>
            </div>
            {sent && (
              <div className="alert alert-success">
                <i className="fi fi-rr-check" style={{ marginRight: 6 }} />Message sent! We'll get back to you within 24 hours.
              </div>
            )}
            <form onSubmit={send}>
              <div className="form-group">
                <label>Subject</label>
                <input required value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Sensor not connecting, Pump not responding…" />
              </div>
              <div className="form-group">
                <label>Message</label>
                <textarea required value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder="Describe your issue in detail. Include device ID, farm name, and what you expected to happen…" rows={5} style={{ width: '100%', resize: 'vertical' }} />
              </div>
              <button className="btn btn-primary btn-block" type="submit">
                <i className="fi fi-rr-paper-plane" style={{ marginRight: 6 }} />Send Message
              </button>
            </form>

            <div style={{ marginTop: '1rem', padding: '0.85rem', background: 'var(--primary-light)', borderRadius: 8, fontSize: '0.82rem', color: 'var(--primary-dark)' }}>
              <strong><i className="fi fi-rr-phone-call" style={{ marginRight: 6 }} />Direct Contact</strong>
              <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <span><i className="fi fi-rr-envelope" style={{ marginRight: 6 }} />ayalewalebie@gmail.com</span>
                <span><i className="fi fi-rr-mobile"   style={{ marginRight: 6 }} />+251 933 834 900</span>
                <span><i className="fi fi-rr-clock"    style={{ marginRight: 6 }} />Monday – Friday, 8am – 6pm (EAT)</span>
                <span><i className="fi fi-rr-marker"   style={{ marginRight: 6 }} />Bahir Dar University, Amhara Region, Ethiopia</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
