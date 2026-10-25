import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, ROLE_LABEL, ROLE_COLOR } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { useNotifications } from '../hooks/useNotifications';
import logoImg from '../assets/logo.jpg';

/**
 * Navigation — exact spec pages per role
 *
 * Farm Owner    : Dashboard · Farm Management · Irrigation Control ·
 *                 Sensors & Devices · Employees & Laborers · Tasks ·
 *                 Finance & Expenses · Reports · Notifications
 *
 * Admin         : Dashboard · User Management · Roles & Permissions ·
 *                 Farm Management · Device Management · System Reports ·
 *                 Notifications
 *
 * Office Manager: Dashboard · Farm · Employees & Laborers · Tasks ·
 *                 Attendance · Expenses · Irrigation Activities · Reports ·
 *                 Notifications
 *
 * Laborer       : Dashboard · My Tasks · Attendance · Assigned Farm ·
 *                 Irrigation Tasks · Notifications
 *
 * Common (all)  : Help · About · Profile
 * Common (owner/admin/office_manager): Settings
 */

// ── SECTION GROUPS per role (shown as dividers in sidebar) ───────────────────
const ALL_NAV = [
  // ── OWNER ──────────────────────────────────────────────────────────────────
  { key: 'home',               icon: 'fi fi-rr-home',              path: '/home',                roles: ['owner'] },
  { key: 'farmControl',        icon: 'fi fi-rr-seedling',           path: '/farm-control',        roles: ['owner'] },
  { key: 'irrigationSchedule', icon: 'fi fi-rr-water-ladder',       path: '/irrigation-schedule', roles: ['owner'] },
  { key: 'sensors',            icon: 'fi fi-rr-signal-alt',         path: '/sensors',             roles: ['owner'] },
  { key: 'cropInfo',           icon: 'fi fi-rr-leaf',               path: '/crop-info',           roles: ['owner'] },
  { key: 'inspection',         icon: 'fi fi-rr-search-alt',         path: '/inspection',          roles: ['owner'] },
  { key: 'employees',          icon: 'fi fi-rr-id-badge',           path: '/employees',           roles: ['owner'] },
  { key: 'tasks',              icon: 'fi fi-rr-clipboard-list',     path: '/tasks',               roles: ['owner'] },
  { key: 'budget',             icon: 'fi fi-rr-coin',               path: '/budget',              roles: ['owner'] },
  { key: 'financialDashboard', icon: 'fi fi-rr-chart-pie',          path: '/financial-dashboard',  roles: ['owner'] },
  { key: 'expenses',           icon: 'fi fi-rr-receipt',            path: '/expenses',            roles: ['owner'] },
  { key: 'income',             icon: 'fi fi-rr-arrow-trend-up',     path: '/income',              roles: ['owner'] },
  { key: 'payroll',            icon: 'fi fi-rr-money-check-edit',   path: '/payroll',             roles: ['owner'] },
  { key: 'reports',            icon: 'fi fi-rr-chart-histogram',    path: '/reports',             roles: ['owner'] },
  { key: 'notifications',      icon: 'fi fi-rr-bell',               path: '/notifications',       roles: ['owner'] },
  // ── ADMIN ──────────────────────────────────────────────────────────────────
  { key: 'home',               icon: 'fi fi-rr-home',              path: '/home',                roles: ['admin'] },
  { key: 'users',              icon: 'fi fi-rr-users-alt',          path: '/users',               roles: ['admin'] },
  { key: 'farmControl',        icon: 'fi fi-rr-seedling',           path: '/farm-control',        roles: ['admin'] },
  { key: 'sensors',            icon: 'fi fi-rr-microchip',          path: '/sensors',             roles: ['admin'] },
  { key: 'cropInfo',           icon: 'fi fi-rr-leaf',               path: '/crop-info',           roles: ['admin'] },
  { key: 'irrigationSchedule', icon: 'fi fi-rr-water-ladder',       path: '/irrigation-schedule', roles: ['admin'] },
  { key: 'tasks',              icon: 'fi fi-rr-clipboard-list',     path: '/tasks',               roles: ['admin'] },
  { key: 'payroll',            icon: 'fi fi-rr-money-check-edit',   path: '/payroll',             roles: ['admin'] },
  { key: 'reports',            icon: 'fi fi-rr-chart-histogram',    path: '/reports',             roles: ['admin'] },
  { key: 'notifications',      icon: 'fi fi-rr-bell',               path: '/notifications',       roles: ['admin'] },
  // ── OFFICE MANAGER ──────────────────────────────────────────────────────────
  { key: 'home',               icon: 'fi fi-rr-home',              path: '/home',                roles: ['office_manager'] },
  { key: 'employees',          icon: 'fi fi-rr-id-badge',           path: '/employees',           roles: ['office_manager'] },
  { key: 'inspection',         icon: 'fi fi-rr-search-alt',         path: '/inspection',          roles: ['office_manager'] },
  { key: 'attendance',         icon: 'fi fi-rr-user-time',          path: '/attendance',          roles: ['office_manager'] },
  { key: 'expenses',           icon: 'fi fi-rr-receipt',            path: '/expenses',            roles: ['office_manager'] },
  { key: 'payroll',            icon: 'fi fi-rr-money-check-edit',   path: '/payroll',             roles: ['office_manager'] },
  { key: 'reports',            icon: 'fi fi-rr-chart-histogram',    path: '/reports',             roles: ['office_manager'] },
  { key: 'notifications',      icon: 'fi fi-rr-bell',               path: '/notifications',       roles: ['office_manager'] },
  // ── LABORER ─────────────────────────────────────────────────────────────────
  { key: 'home',               icon: 'fi fi-rr-home',              path: '/home',               roles: ['labor'] },
  { key: 'tasks',              icon: 'fi fi-rr-clipboard-list',    path: '/tasks',              roles: ['labor'] },
  { key: 'attendance',         icon: 'fi fi-rr-user-time',         path: '/attendance',         roles: ['labor'] },
  { key: 'farmControl',        icon: 'fi fi-rr-map-marker',        path: '/farm-control',       roles: ['labor'] },
  { key: 'irrigationSchedule', icon: 'fi fi-rr-water-ladder',      path: '/irrigation-schedule',roles: ['labor'] },
  { key: 'problemReports',     icon: 'fi fi-rr-triangle-warning',  path: '/problem-reports',    roles: ['labor'] },
  { key: 'payroll',            icon: 'fi fi-rr-money-check-edit',  path: '/payroll',            roles: ['labor'] },
  { key: 'notifications',      icon: 'fi fi-rr-bell',              path: '/notifications',       roles: ['labor'] },
];

// ── Utility nav — common to all (bottom of sidebar) ─────────────────────────
const UTIL_NAV = [
  { key: 'settings', icon: 'fi fi-rr-settings',     path: '/settings',  roles: ['owner', 'admin', 'office_manager'] },
  { key: 'profile',  icon: 'fi fi-rr-user',          path: '/profile',   roles: ['owner', 'admin', 'office_manager', 'labor'] },
  { key: 'help',     icon: 'fi fi-rr-interrogation', path: '/help',      roles: ['owner', 'admin', 'office_manager', 'labor'] },
  { key: 'about',    icon: 'fi fi-rr-info',           path: '/about',     roles: ['owner', 'admin', 'office_manager', 'labor'] },
];

// ── Sidebar section divider labels per role group ────────────────────────────
// Shown above nav groups to clearly separate sections in the sidebar
const NAV_GROUP_KEYS = {
  owner: [
    { labelKey: null,       keys: ['home'] },
    { labelKey: 'farm',     keys: ['farmControl', 'irrigationSchedule', 'sensors', 'cropInfo', 'inspection'] },
    { labelKey: 'employees',keys: ['employees', 'tasks'] },
    { labelKey: 'budget',   keys: ['budget', 'financialDashboard', 'expenses', 'income', 'payroll'] },
    { labelKey: 'reports',  keys: ['reports', 'notifications'] },
  ],
  admin: [
    { labelKey: null,                keys: ['home'] },
    { labelKey: 'userManagement',    keys: ['users'] },
    { labelKey: 'farmControl',       keys: ['farmControl', 'sensors', 'cropInfo', 'irrigationSchedule', 'tasks'] },
    { labelKey: 'myPayroll',         keys: ['payroll'] },
    { labelKey: 'reports',           keys: ['reports', 'notifications'] },
  ],
  office_manager: [
    { labelKey: null,      keys: ['home'] },
    { labelKey: 'employees', keys: ['employees', 'inspection', 'attendance'] },
    { labelKey: 'budget',  keys: ['expenses', 'payroll'] },
    { labelKey: 'reports', keys: ['reports', 'notifications'] },
  ],
  labor: [
    { labelKey: null,          keys: ['home'] },
    { labelKey: 'tasks',       keys: ['tasks', 'farmControl', 'irrigationSchedule'] },
    { labelKey: 'attendance',  keys: ['attendance'] },
    { labelKey: 'reports',     keys: ['problemReports', 'notifications'] },
    { labelKey: 'myPayroll',   keys: ['payroll'] },
  ],
};

const PAGE_LABEL_MAP = {
  '/home':                 'Dashboard',
  '/farm-control':         'Farm Management',
  '/sensors':              'Sensors & Devices',
  '/irrigation-schedule':  'Irrigation Work',
  '/problem-reports':      'Problem Reports',
  '/schedule':             'Work Schedules',
  '/attendance':           'Attendance',
  '/tasks':                'Tasks',
  '/users':                'User Management',
  '/employees':            'Employees & Laborers',
  '/notifications':        'Notifications',
  '/reports':              'Reports',
  '/history':              'Activity Log',
  '/settings':             'Settings',
  '/profile':              'Profile',
  '/help':                 'Help & Support',
  '/about':                'About',
  '/budget':               'Budget',
  '/payroll':              'Payroll',
  '/expenses':             'Expenses',
  '/income':               'Income',
};

const ROLE_ICON = {
  owner:          'fi-rr-crown',
  admin:          'fi-rr-shield-check',
  office_manager: 'fi-rr-briefcase',
  labor:          'fi-rr-helmet-safety',
};

const TYPE_COLOR = { warning: '#f59e0b', danger: '#ef4444', info: '#3b82f6', success: '#22c55e' };
const TYPE_ICON  = { warning: '⚠️', danger: '🔴', info: 'ℹ️', success: '✅' };

export default function Layout({ children }) {
  const { user, logout, can } = useAuth();
  const { t, lang, switchLang } = useLang();
  const navigate  = useNavigate();
  const location  = useLocation();
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bellOpen,    setBellOpen]    = useState(false);
  const bellRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  const currentPath = location.pathname;
  const pageLabel   = t(Object.entries({
    '/home': 'home', '/farm-control': 'farmControl', '/sensors': 'sensors',
    '/irrigation-schedule': 'irrigationSchedule', '/problem-reports': 'problemReports',
    '/attendance': 'attendance', '/tasks': 'tasks', '/users': 'userManagement',
    '/employees': 'employees', '/notifications': 'notifications',
    '/reports': 'reports', '/history': 'history', '/settings': 'settingsTitle',
    '/profile': 'profileTitle', '/help': 'help', '/about': 'about',
    '/budget': 'budget', '/payroll': 'payroll', '/expenses': 'expenses',
    '/income': 'income', '/my-payroll': 'myPayroll', '/my-attendance': 'myAttendance',
    '/financial-dashboard': 'financialDashboard',
  }).find(([p]) => currentPath.startsWith(p))?.[1] || 'home');
  const mainNav     = ALL_NAV.filter(n => n.roles.includes(user?.role));
  const utilNav     = UTIL_NAV.filter(n => n.roles.includes(user?.role));

  const photo    = localStorage.getItem(`sis_photo_${user?.id || user?._id}`);
  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';
  const roleColor = ROLE_COLOR[user?.role] || 'var(--primary)';
  const roleLabel = ROLE_LABEL[user?.role] || user?.role;

  return (
    <div className="app-layout">
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sidebar-logo">
          <img
            src={logoImg} alt="logo"
            style={{ width: 42, height: 42, borderRadius: 8, objectFit: 'contain', flexShrink: 0, background: '#fff', padding: 2 }}
          />
          <div>
            <h2>{t('appName')}</h2>
          </div>
        </div>

        <nav className="sidebar-nav">
          {(() => {
            const groups = NAV_GROUP_KEYS[user?.role];
            if (!groups) return (
              <div className="nav-section">
                {mainNav.map((item, idx) => (
                  <NavLink key={`${item.path}-${idx}`} to={item.path}
                    className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                    onClick={() => setSidebarOpen(false)}>
                    <span className="nav-icon"><i className={item.icon} /></span>
                    <span>{t(item.key)}</span>
                  </NavLink>
                ))}
              </div>
            );

            const rendered = [];
            groups.forEach((group, gi) => {
              const groupItems = mainNav.filter(n => group.keys.includes(n.key));
              if (!groupItems.length) return;
              rendered.push(
                <div key={`grp-${gi}`} className="nav-section">
                  {gi > 0 && group.labelKey && (
                    <span className="nav-group-label">{t(group.labelKey)}</span>
                  )}
                  {groupItems.map((item, idx) => (
                    <NavLink key={`${item.path}-${group.labelKey}-${idx}`} to={item.path}
                      className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                      onClick={() => setSidebarOpen(false)}>
                      <span className="nav-icon"><i className={item.icon} /></span>
                      <span>{t(item.key)}</span>
                    </NavLink>
                  ))}
                </div>
              );
            });

            const coveredKeys = groups.flatMap(g => g.keys);
            const uncovered   = mainNav.filter(n => !coveredKeys.includes(n.key));
            if (uncovered.length) {
              rendered.push(
                <div key="uncovered" className="nav-section">
                  {uncovered.map((item, idx) => (
                    <NavLink key={`unc-${item.path}-${idx}`} to={item.path}
                      className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                      onClick={() => setSidebarOpen(false)}>
                      <span className="nav-icon"><i className={item.icon} /></span>
                      <span>{t(item.key)}</span>
                    </NavLink>
                  ))}
                </div>
              );
            }
            return rendered;
          })()}

          {utilNav.length > 0 && (
            <div className="nav-section" style={{ marginTop: '0.25rem' }}>
              <span className="nav-group-label">{t('accountInfo')}</span>
              {utilNav.map((item, idx) => (
                <NavLink key={`util-${item.path}-${idx}`} to={item.path}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                  onClick={() => setSidebarOpen(false)}>
                  <span className="nav-icon"><i className={item.icon} /></span>
                  <span>{t(item.key)}</span>
                </NavLink>
              ))}
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogout}>
            <i className="fi fi-rr-sign-out-alt" /> {t('logout')}
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle menu">
              <i className="fi fi-rr-bars-sort" />
            </button>
            <span className="topbar-title">{pageLabel}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>

            {/* Language switcher */}
            <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 20, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
              <button onClick={() => switchLang('en')} style={{ padding: '3px 10px', fontSize: '0.72rem', fontWeight: 700, background: lang === 'en' ? '#166534' : 'transparent', color: lang === 'en' ? '#fff' : '#6b7280', border: 'none', cursor: 'pointer', transition: 'all 0.15s' }}>EN</button>
              <button onClick={() => switchLang('am')} style={{ padding: '3px 10px', fontSize: '0.72rem', fontWeight: 700, background: lang === 'am' ? '#166534' : 'transparent', color: lang === 'am' ? '#fff' : '#6b7280', border: 'none', cursor: 'pointer', transition: 'all 0.15s' }}>አማ</button>
            </div>

            {/* Notification bell */}
            <div ref={bellRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setBellOpen(prev => !prev)}
                aria-label="Notifications"
                style={{
                  position: 'relative',
                  background: bellOpen ? 'var(--primary-light)' : 'none',
                  border: 'none', fontSize: '1.3rem', cursor: 'pointer',
                  padding: '4px 6px', borderRadius: 8, transition: 'background 0.15s',
                }}
              >
                <i className="fi fi-rr-bell" style={{ fontSize: '1.2rem', verticalAlign: 'middle' }} />
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute', top: 0, right: 0,
                    background: '#ef4444', color: '#fff',
                    fontSize: '0.6rem', fontWeight: 700,
                    borderRadius: '50%', width: 16, height: 16,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '2px solid #fff', lineHeight: 1,
                  }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {bellOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                  width: 340, maxHeight: 420,
                  background: '#fff', borderRadius: 12,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                  border: '1px solid var(--border)',
                  zIndex: 500, display: 'flex', flexDirection: 'column', overflow: 'hidden',
                }}>
                  <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--primary-light)' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--primary-dark)' }}>
                      <i className="fi fi-rr-bell" style={{ marginRight: 6 }} />
                      {t('notificationsTitle')}
                      {unreadCount > 0 && (
                        <span style={{ marginLeft: 8, background: '#ef4444', color: '#fff', borderRadius: 20, padding: '1px 7px', fontSize: '0.72rem' }}>
                          {unreadCount} new
                        </span>
                      )}
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {unreadCount > 0 && (
                        <button onClick={markAllRead} style={{ fontSize: '0.72rem', color: 'var(--primary-dark)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                          {t('markAllRead')}
                        </button>
                      )}
                      <button onClick={() => { navigate('/settings'); setBellOpen(false); }} style={{ fontSize: '0.72rem', color: 'var(--primary-dark)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                        {t('settings')}
                      </button>
                    </div>
                  </div>

                  <div style={{ overflowY: 'auto', flex: 1 }}>
                    {notifications.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        <div style={{ fontSize: '2rem', marginBottom: 8 }}>✅</div>
                        {t('noNotifications')}
                      </div>
                    ) : notifications.map((n, i) => {
                      const color = TYPE_COLOR[n.type] || '#6b7280';
                      return (
                        <div
                          key={n.id || i}
                          onClick={() => markRead(n.id)}
                          style={{ padding: '0.65rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', background: 'transparent', transition: 'background 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <div style={{ width: 3, borderRadius: 2, background: color, flexShrink: 0, alignSelf: 'stretch', minHeight: 36 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: 600, fontSize: '0.83rem', color: 'var(--text)' }}>
                                {TYPE_ICON[n.type]} {n.event}
                              </span>
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', marginLeft: 8 }}>{n.time}</span>
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {n.details}
                            </div>
                            {n.zone && n.zone !== '—' && (
                              <span style={{ fontSize: '0.68rem', background: '#dbeafe', color: '#1e40af', padding: '1px 7px', borderRadius: 20, marginTop: 4, display: 'inline-block' }}>
                                {n.zone}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ padding: '0.55rem 1rem', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                    <button
                      onClick={() => { navigate('/settings'); setBellOpen(false); }}
                      style={{ fontSize: '0.78rem', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
                    >
                      View all in Settings →
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Profile chip */}
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}
              onClick={() => navigate('/profile')}
              title="Go to profile"
            >
              <div style={{ textAlign: 'right', lineHeight: 1.3 }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)' }}>{user?.name}</div>
                <div style={{ fontSize: '0.72rem', color: roleColor, fontWeight: 600 }}>{roleLabel}</div>
              </div>
              {photo ? (
                <img
                  src={photo} alt="profile"
                  style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${roleColor}`, flexShrink: 0 }}
                />
              ) : (
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${roleColor}, var(--primary-dark))`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.85rem', fontWeight: 700, color: '#fff',
                  border: `2px solid ${roleColor}44`, flexShrink: 0,
                }}>
                  {initials}
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="page-content">{children}</main>

        <footer style={{ background: '#0f3320', color: '#86efac', textAlign: 'center', padding: '0.75rem 1rem', fontSize: '0.72rem', opacity: 0.75, flexShrink: 0 }}>
          © {new Date().getFullYear()} Smart Irrigation System · Bahir Dar University · Developed by Alebie Ayalew &amp; Belayneh Shiferaw
        </footer>
      </div>
    </div>
  );
}
