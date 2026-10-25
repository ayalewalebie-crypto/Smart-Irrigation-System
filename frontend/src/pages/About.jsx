import { useLang } from '../context/LanguageContext';

const FEATURES_LIST = [
  { icon: 'fi-rr-signal-alt',     text: 'Real-time soil moisture, temperature, humidity, pH and water level monitoring from ESP8266/Arduino nodes' },
  { icon: 'fi-rr-tint',           text: 'Automated zone-based irrigation triggered by sensor thresholds — manual override always available' },
  { icon: 'fi-rr-crown',          text: '4-role RBAC: Farm Owner, Admin, Office Manager, and Laborer with role-specific dashboards' },
  { icon: 'fi-rr-chart-histogram',text: 'Daily water usage charts, sensor logs, financial reports, payroll, and exportable CSV data' },
  { icon: 'fi-rr-calendar',       text: 'Automated irrigation scheduling per farm — set timing, duration, and auto/manual mode' },
  { icon: 'fi-rr-globe',          text: 'Full bilingual support: English and Amharic (አማርኛ) throughout the entire application' },
  { icon: 'fi-rr-clipboard-list', text: 'Task management: assign field tasks, track Pending → In Progress → Completed, collect work reports' },
  { icon: 'fi-rr-bell-ring',      text: 'Instant alerts for offline sensors, low moisture, high temperature, low water level and pH anomalies' },
  { icon: 'fi-rr-id-badge',       text: 'HR management: employee records, attendance tracking, payroll processing, and work scheduling' },
  { icon: 'fi-rr-receipt',        text: 'Financial management: budget planning, expense tracking, income recording, and profit/loss reporting' },
];

const TEAM = [
  { name: 'Alebie Ayalew',     role: 'Lead Developer & System Architect',  icon: 'fi-rr-laptop' },
  { name: 'Belayneh Shiferaw', role: 'Hardware Engineer (Arduino/ESP8266)', icon: 'fi-rr-microchip' },
];

const STACK = [
  { layer: 'Frontend',  tech: 'React 19 + Vite',         icon: 'fi-rr-browser' },
  { layer: 'Backend',   tech: 'Node.js + Express',        icon: 'fi-rr-server' },
  { layer: 'Database',  tech: 'MongoDB (Mongoose)',        icon: 'fi-rr-database' },
  { layer: 'Hardware',  tech: 'Arduino Uno + ESP8266',     icon: 'fi-rr-microchip' },
  { layer: 'Protocol',  tech: 'HTTP REST',                 icon: 'fi-rr-signal-alt' },
  { layer: 'Languages', tech: 'English & Amharic (አማርኛ)', icon: 'fi-rr-language' },
];

const CONTACT = [
  { icon: 'fi-rr-envelope', label: 'Email',   value: 'ayalewalebie@gmail.com' },
  { icon: 'fi-rr-mobile',   label: 'Phone',   value: '+251 933 834 900' },
  { icon: 'fi-rr-marker',   label: 'Address', value: 'Bahir Dar, Amhara Region, Ethiopia' },
];

const TAGS = [
  { icon: 'fi-rr-code-branch', text: 'Version: 1.0.0' },
  { icon: 'fi-rr-graduation-cap', text: 'Bahir Dar University' },
  { icon: 'fi-rr-globe',         text: 'Amhara Region, Ethiopia' },
  { icon: 'fi-rr-unlock',        text: 'Open Source' },
];

export default function About() {
  const { t } = useLang();

  return (
    <div>
      <div className="page-header">
        <h1><i className="fi fi-rr-info" style={{ marginRight: 8 }} />About the System</h1>
      </div>

      {/* Hero banner */}
      <div className="card" style={{ marginBottom: '1rem', background: 'linear-gradient(135deg, #1a3c24 0%, #2d7a3a 100%)', color: '#fff', border: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.2rem', flexShrink: 0 }}>
            <i className="fi fi-rr-tint" style={{ color: '#86efac' }} />
          </div>
          <div style={{ flex: 1, minWidth: 260 }}>
            <h2 style={{ color: '#fff', fontSize: '1.45rem', marginBottom: '0.4rem' }}>
              Smart Irrigation System — ዘመናዊ የመስኖ ስርዓት
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.88)', fontSize: '0.88rem', lineHeight: 1.75, maxWidth: 620 }}>
              This system was developed to address the critical irrigation challenges faced by
              smallholder farmers in Ethiopia, particularly in the Amhara Region around Bahir Dar.
              By integrating low-cost IoT hardware (Arduino Uno &amp; ESP8266) with a full-stack
              web platform and MongoDB database, this system enables real-time soil moisture
              monitoring, automated zone-based irrigation control, and data-driven farm management —
              helping farmers conserve water, reduce labor costs, and increase crop yield sustainably.
            </p>
            <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.82rem', lineHeight: 1.7, maxWidth: 620, marginTop: '0.6rem' }}>
              ይህ ስርዓት በኢትዮጵያ፣ በተለይም በአማራ ክልል ባህር ዳር አካባቢ ባሉ አርሶ አደሮች የሚጋፈጡትን
              የመስኖ ችግሮች ለመፍታት የተዘጋጀ ነው። Arduino Uno እና ESP8266 የሚጠቀም ዘመናዊ IoT
              ቴክኖሎጂን ከድር ፕላትፎርምና MongoDB ዳታቤዝ ጋር በማዋሃድ ራስ-ሰር የመስኖ ቁጥጥር ያረጋግጣል።
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.85rem', flexWrap: 'wrap' }}>
              {TAGS.map(tag => (
                <span key={tag.text} style={{ background: 'rgba(255,255,255,0.15)', padding: '3px 12px', borderRadius: 20, fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <i className={`fi ${tag.icon}`} />{tag.text}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        {/* Features */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><i className="fi fi-rr-star" style={{ marginRight: 6 }} />Key Features</span>
          </div>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {FEATURES_LIST.map((f, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: '0.86rem', padding: '0.35rem 0', borderBottom: '1px solid var(--border)' }}>
                <i className={`fi ${f.icon}`} style={{ color: 'var(--primary)', fontWeight: 700, flexShrink: 0, marginTop: 2, fontSize: '0.9rem' }} />
                <span>{f.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Tech stack */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><i className="fi fi-rr-settings" style={{ marginRight: 6 }} />Technology Stack</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {STACK.map(({ layer, tech, icon }) => (
              <div key={layer} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.42rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.87rem' }}>
                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <i className={`fi ${icon}`} />{layer}
                </span>
                <span style={{ fontWeight: 500 }}>{tech}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Team */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><i className="fi fi-rr-users-alt" style={{ marginRight: 6 }} />Development Team</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {TEAM.map(m => (
              <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0, border: '2px solid #c8e6c9' }}>
                  <i className={`fi ${m.icon}`} style={{ color: 'var(--primary-dark)' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--primary-dark)' }}>{m.name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>{m.role}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '1.2rem', padding: '0.85rem', background: 'var(--primary-light)', borderRadius: 8, fontSize: '0.83rem', color: 'var(--primary-dark)', lineHeight: 1.65 }}>
            <strong><i className="fi fi-rr-graduation-cap" style={{ marginRight: 6 }} />Academic Project</strong><br />
            Developed as a capstone/thesis project at <strong>Bahir Dar University</strong>,
            focusing on precision agriculture and smart water management for Ethiopian
            smallholder farmers in the Amhara Region.
          </div>
        </div>

        {/* Contact */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><i className="fi fi-rr-envelope" style={{ marginRight: 6 }} />Contact</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.88rem' }}>
            {CONTACT.map(({ icon, label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <i className={`fi ${icon}`} />{label}
                </span>
                <span style={{ fontWeight: 500, textAlign: 'right' }}>{value}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--primary-light)', borderRadius: 8, textAlign: 'center', fontSize: '0.82rem', color: 'var(--primary-dark)', fontWeight: 500 }}>
            <i className="fi fi-rr-balance-scale" style={{ marginRight: 6 }} />License: Open Source (Academic Project)
          </div>
        </div>
      </div>
    </div>
  );
}
