import { useState, useEffect, useCallback } from 'react';
import { useAuth, ROLE_LABEL, ROLE_COLOR } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { userApi } from '../services/api';

const ROLE_BG = {
  owner:          '#f5f3ff',
  admin:          '#fef2f2',
  office_manager: '#ecfeff',
  labor:          '#eff6ff',
};
const ROLE_ICON = {
  owner:          'fi-rr-crown',
  admin:          'fi-rr-shield-check',
  office_manager: 'fi-rr-briefcase',
  labor:          'fi-rr-helmet-safety',
};

const STATUS_COLOR = {
  active:      '#22c55e',
  suspended:   '#dc2626',
  deactivated: '#6b7280',
  pending:     '#f59e0b',
  rejected:    '#ef4444',
};
const STATUS_BG = {
  active:      '#dcfce7',
  suspended:   '#fee2e2',
  deactivated: '#f3f4f6',
  pending:     '#fffbeb',
  rejected:    '#fee2e2',
};
const STATUS_ICON = {
  active:      'fi-rr-check-circle',
  suspended:   'fi-rr-ban',
  deactivated: 'fi-rr-circle',
  pending:     'fi-rr-clock',
  rejected:    'fi-rr-cross-circle',
};
const STATUS_LABEL = {
  active:      'Active',
  suspended:   'Blocked',
  deactivated: 'Inactive',
  pending:     'Pending',
  rejected:    'Rejected',
};

const PW_REGEX   = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;
const NAME_REGEX = /^[a-zA-Z\u1200-\u137F\s'\-]+$/;

const EMPTY_FORM = {
  name: '', email: '', password: '', role: 'labor',
  phone: '', farmName: '', location: '', accountNumber: '',
};

const TABS = [
  { key: 'all',       labelKey: 'allUsers' },
  { key: 'pending',   labelKey: 'pendingApproval' },
  { key: 'active',    labelKey: 'activeUsers' },
  { key: 'suspended', labelKey: 'blockedUsers' },
];

export default function UserManagement() {
  const { user: me } = useAuth();
  const { t }        = useLang();

  const [activeTab,   setActiveTab]   = useState('all');
  const [users,       setUsers]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [toast,       setToast]       = useState({ msg: '', type: 'success' });
  const [search,      setSearch]      = useState('');
  const [roleFilter,  setRoleFilter]  = useState('all');
  const [showForm,    setShowForm]    = useState(false);
  const [editUser,    setEditUser]    = useState(null);
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [saving,      setSaving]      = useState(false);
  const [showPw,      setShowPw]      = useState(false);
  const [actionUser,  setActionUser]  = useState(null);
  const [showRole,    setShowRole]    = useState(false);
  const [newRole,     setNewRole]     = useState('');
  const [showReject,  setShowReject]  = useState(false);
  const [rejectTarget,setRejectTarget]= useState(null);
  const [rejectReason,setRejectReason]= useState('');

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: 'success' }), 3000);
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = {};
      if (activeTab !== 'all') params.status = activeTab;
      const data = await userApi.getAll(params);
      setUsers(data);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [activeTab]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Counts per tab
  const counts = {
    all:       users.length,
    pending:   users.filter(u => u.accountStatus === 'pending').length,
    active:    users.filter(u => u.accountStatus === 'active').length,
    suspended: users.filter(u => u.accountStatus === 'suspended').length,
  };

  const roleCounts = ['owner', 'admin', 'office_manager', 'labor'].reduce(
    (acc, r) => ({ ...acc, [r]: users.filter(u => u.role === r).length }), {}
  );

  // Filtered list
  const filtered = users.filter(u => {
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
    return matchRole && matchSearch;
  });

  const openCreate = () => { setEditUser(null); setForm(EMPTY_FORM); setShowPw(false); setError(''); setShowForm(true); };
  const openEdit   = (u) => {
    setEditUser(u);
    setForm({ name: u.name, email: u.email, password: '', role: u.role, phone: u.phone || '', farmName: u.farmName || '', location: u.location || '', accountNumber: u.accountNumber || '' });
    setShowPw(false); setError(''); setShowForm(true);
  };

  const validate = () => {
    if (!form.name.trim())                              { setError('Name is required.'); return false; }
    if (!NAME_REGEX.test(form.name.trim()))             { setError('Name must contain letters only.'); return false; }
    if (!form.email.trim())                             { setError('Email is required.'); return false; }
    if (!editUser && !form.password)                    { setError('Password is required.'); return false; }
    if (form.password && !PW_REGEX.test(form.password)){ setError('Password must be ≥8 chars with uppercase, lowercase, number and special character.'); return false; }
    if (editUser && form.password && me?.role !== 'owner') { setError('Only the Owner can change a user password.'); return false; }
    return true;
  };

  const handleSave = async () => {
    setError('');
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;
      if (editUser) {
        await userApi.update(editUser._id || editUser.id, payload);
        showToast(`${form.name} updated successfully.`);
      } else {
        await userApi.create(payload);
        showToast(`${form.name} created. They will be asked to change their temporary password on first login.`);
      }
      setShowForm(false); setEditUser(null); setForm(EMPTY_FORM);
      await fetchUsers();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleSuspend = async (u) => {
    if (!window.confirm(`Block "${u.name}"?\nThey will be unauthorized and cannot log in until unblocked.`)) return;
    try { await userApi.suspend(u._id || u.id); showToast(`${u.name} has been blocked.`, 'warning'); fetchUsers(); }
    catch (err) { setError(err.message); }
  };

  const handleActivate = async (u) => {
    try { await userApi.activate(u._id || u.id); showToast(`${u.name} re-activated.`); fetchUsers(); }
    catch (err) { setError(err.message); }
  };

  const handleDeactivate = async (u) => {
    if (!window.confirm(`Deactivate "${u.name}"? This is permanent unless manually reversed.`)) return;
    try { await userApi.deactivate(u._id || u.id); showToast(`${u.name} deactivated.`, 'warning'); fetchUsers(); }
    catch (err) { setError(err.message); }
  };

  const handleApprove = async (u) => {
    if (!window.confirm(`Approve "${u.name}"? They will be able to log in and an email notification will be sent.`)) return;
    try { await userApi.approve(u._id || u.id); showToast(`${u.name} approved successfully.`); fetchUsers(); }
    catch (err) { setError(err.message); }
  };

  const openRejectModal = (u) => { setRejectTarget(u); setRejectReason(''); setShowReject(true); };
  const handleReject = async () => {
    if (!rejectTarget) return;
    try {
      await userApi.reject(rejectTarget._id || rejectTarget.id, rejectReason);
      showToast(`${rejectTarget.name}'s registration has been rejected.`, 'warning');
      setShowReject(false); setRejectTarget(null); fetchUsers();
    } catch (err) { setError(err.message); }
  };

  const openRoleModal = (u) => { setActionUser(u); setNewRole(u.role); setShowRole(true); };
  const handleRoleChange = async () => {
    if (!actionUser || newRole === actionUser.role) { setShowRole(false); return; }
    try { await userApi.changeRole(actionUser._id || actionUser.id, newRole); showToast(`${actionUser.name} role changed to ${ROLE_LABEL[newRole]}.`); setShowRole(false); setActionUser(null); fetchUsers(); }
    catch (err) { setError(err.message); }
  };

  const handleDelete = async (u) => {
    if (String(u._id || u.id) === String(me?.id)) { setError('You cannot delete your own account.'); return; }
    if (!window.confirm(`Permanently delete "${u.name}"? This cannot be undone.`)) return;
    try { await userApi.remove(u._id || u.id); showToast(`${u.name} deleted.`, 'warning'); fetchUsers(); }
    catch (err) { setError(err.message); }
  };

  const isSelf  = (u) => String(u._id || u.id) === String(me?.id);
  const isOwner = me?.role === 'owner';
  const isAdmin = me?.role === 'admin';

  // Can this viewer perform actions on target user?
  // Admin can manage office_manager and labor only
  const canManage = (u) => {
    if (isOwner) return u.role !== 'owner';
    if (isAdmin) return ['office_manager', 'labor'].includes(u.role);
    return false;
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <h1><i className="fi fi-rr-users-alt" style={{ marginRight: 8 }} />{t('userManagement')}</h1>
        <div className="header-actions">
          {isOwner && (
            <button className="btn btn-primary btn-sm" onClick={openCreate}>
              <i className="fi fi-rr-user-add" style={{ marginRight: 4 }} />New User
            </button>
          )}
          <button className="btn btn-outline btn-sm" onClick={fetchUsers} disabled={loading}>
            <i className="fi fi-rr-refresh" style={{ marginRight: 4 }} />Refresh
          </button>
        </div>
      </div>

      {toast.msg && <div className={`alert alert-${toast.type}`}><i className={`fi ${toast.type === 'success' ? 'fi-rr-check' : 'fi-rr-triangle-warning'}`} style={{ marginRight: 6 }} />{toast.msg}</div>}
      {error     && <div className="alert alert-error"><i className="fi fi-rr-triangle-warning" style={{ marginRight: 6 }} />{error}<button style={{ marginLeft: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 700 }} onClick={() => setError('')}>✕</button></div>}

      {/* Summary stats */}
      <div className="stats-grid" style={{ marginBottom: '1rem' }}>
        {[
          { role: 'all',            label: t('allUsers'),   icon: 'fi-rr-users-alt',    color: '' },
          { role: 'owner',          label: t('farmOwners'), icon: 'fi-rr-crown',         color: '' },
          { role: 'admin',          label: t('admins'),     icon: 'fi-rr-shield-check',  color: 'danger' },
          { role: 'office_manager', label: t('officeMgrs'), icon: 'fi-rr-briefcase',     color: 'info' },
          { role: 'labor',          label: t('laborers'),   icon: 'fi-rr-helmet-safety', color: '' },
        ].map(s => (
          <div key={s.role} className={`stat-card${s.color ? ' ' + s.color : ''}`}
            style={{ cursor: 'pointer', outline: roleFilter === s.role ? '2px solid var(--primary)' : 'none' }}
            onClick={() => setRoleFilter(s.role)}>
            <span className="stat-icon"><i className={`fi ${s.icon}`} /></span>
            <div className="stat-info">
              <label>{s.label}</label>
              <strong>{s.role === 'all' ? counts.all : (roleCounts[s.role] ?? 0)}</strong>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', borderBottom: '2px solid var(--border)', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`btn btn-sm ${activeTab === tab.key ? 'btn-primary' : 'btn-outline'}`}
            style={{ position: 'relative' }}>
            {t(tab.labelKey)}
            {tab.key === 'pending' && counts.pending > 0 && (
              <span style={{
                marginLeft: 6, background: '#ef4444', color: '#fff',
                borderRadius: 10, fontSize: '0.68rem', fontWeight: 700,
                padding: '1px 6px', lineHeight: 1.5,
              }}>{counts.pending}</span>
            )}
          </button>
        ))}
      </div>

      {/* Search + role filter */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="search" placeholder={t('searchUsers')} value={search}
          onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {['all', 'owner', 'admin', 'office_manager', 'labor'].map(r => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={`btn btn-sm ${roleFilter === r ? 'btn-primary' : 'btn-outline'}`}>
              {r === 'all' ? 'All Roles' : ROLE_LABEL[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <div className="card" style={{ marginBottom: '1.2rem', borderLeft: '4px solid var(--primary)' }}>
          <div className="card-header">
            <span className="card-title">
              <i className={`fi fi-rr-${editUser ? 'edit' : 'user-add'}`} style={{ marginRight: 6 }} />
              {editUser ? `Edit — ${editUser.name}` : 'Create New User'}
            </span>
            <button className="btn btn-outline btn-sm" onClick={() => { setShowForm(false); setEditUser(null); setError(''); }}>✕</button>
          </div>
          {!editUser && (
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '0.6rem 0.8rem', marginBottom: '0.75rem', fontSize: '0.8rem', color: '#1e40af' }}>
              <i className="fi fi-rr-info" style={{ marginRight: 5 }} />
              Owner-created accounts are activated immediately with a temporary password the user must change on first login.
            </div>
          )}
          <div className="form-row">
            <div className="form-group">
              <label>Full Name *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Abebe Kebede" />
            </div>
            <div className="form-group">
              <label>Email *</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="name@farm.com" readOnly={!!editUser} style={editUser ? { background: '#f9fafb', color: 'var(--text-muted)' } : {}} />
            </div>
            {/* Password — only Owner can set/reset; hidden when Admin is editing */}
            {(!editUser || me?.role === 'owner') && (
              <div className="form-group">
                <label>{editUser ? 'New Password (Owner only — leave blank to keep)' : 'Temporary Password *'}</label>
                <div className="pw-wrap">
                  <input type={showPw ? 'text' : 'password'} value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    placeholder={editUser ? '••••••••' : 'Min 8 chars'} autoComplete="new-password" />
                  <button type="button" className="toggle-pw" onClick={() => setShowPw(p => !p)}>
                    <i className={`fi ${showPw ? 'fi-rr-eye-crossed' : 'fi-rr-eye'}`} />
                  </button>
                </div>
              </div>
            )}
            <div className="form-group">
              <label>Role *</label>
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} disabled={!!editUser && editUser.role === 'owner'}>
                <option value="labor">Laborer</option>
                <option value="office_manager">Office Manager</option>
                <option value="admin">Admin</option>
              </select>
              {editUser && editUser.role === 'owner' && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Owner role cannot be changed here.</span>}
            </div>
            <div className="form-group"><label>Phone</label><input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+251911…" /></div>
            <div className="form-group">
              <label>
                Account Number {!editUser && <span style={{ color: '#ef4444' }}>*</span>}
              </label>
              <input
                value={form.accountNumber}
                onChange={e => setForm({ ...form, accountNumber: e.target.value })}
                placeholder="Bank account number for Chapa salary"
                style={{ fontFamily: 'monospace', letterSpacing: '0.04em' }}
              />
              <span style={{ fontSize: '0.7rem', color: '#7c3aed', marginTop: 3, display: 'block' }}>
                <i className="fi fi-rr-paper-plane" style={{ marginRight: 4 }} />Used for Chapa salary payments
              </span>
            </div>
            <div className="form-group"><label>Farm Name</label><input value={form.farmName} onChange={e => setForm({ ...form, farmName: e.target.value })} placeholder="Green Valley Farm" /></div>
            <div className="form-group"><label>Location</label><input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Bahir Dar" /></div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? '⏳ Saving…' : <><i className="fi fi-rr-check" style={{ marginRight: 4 }} />{editUser ? 'Save Changes' : 'Create User'}</>}
            </button>
            <button className="btn btn-outline" onClick={() => { setShowForm(false); setEditUser(null); setError(''); }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {[1, 2, 3, 4].map(i => <div key={i} style={{ height: 64, background: '#e5e7eb', borderRadius: 10, animation: 'pulse 1.5s infinite' }}><style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style></div>)}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && !error && (
        <div className="chart-box">
          <span className="ch-icon"><i className="fi fi-rr-users-alt" /></span>
          <span>{search || roleFilter !== 'all' ? 'No users match your filter.' : 'No users found.'}</span>
        </div>
      )}

      {/* User table */}
      {!loading && filtered.length > 0 && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Contact</th>
                  <th>Farm / Location</th>
                  <th>Joined</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const self = isSelf(u);
                  const status = u.accountStatus || 'active';
                  return (
                    <tr key={u._id || u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: `linear-gradient(135deg, ${ROLE_COLOR[u.role] || '#166534'}, #166534)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem', color: '#fff' }}>
                            {u.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                              {u.name}
                              {self && <span style={{ fontSize: '0.68rem', background: '#dbeafe', color: '#1e40af', borderRadius: 10, padding: '1px 6px', marginLeft: 6 }}>You</span>}
                              {u.mustChangePassword && <span style={{ fontSize: '0.68rem', background: '#fef3c7', color: '#92400e', borderRadius: 10, padding: '1px 6px', marginLeft: 6 }}>Temp PW</span>}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.78rem', background: ROLE_BG[u.role] || '#f3f4f6', color: ROLE_COLOR[u.role] || '#6b7280', border: `1px solid ${(ROLE_COLOR[u.role] || '#6b7280')}44`, borderRadius: 20, padding: '3px 10px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <i className={`fi ${ROLE_ICON[u.role] || 'fi-rr-user'}`} />{ROLE_LABEL[u.role] || u.role}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.75rem', background: STATUS_BG[status] || '#f3f4f6', color: STATUS_COLOR[status] || '#6b7280', border: `1px solid ${STATUS_COLOR[status] || '#6b7280'}44`, borderRadius: 20, padding: '3px 10px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <i className={`fi ${STATUS_ICON[status] || 'fi-rr-circle'}`} />
                          {STATUS_LABEL[status] || status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{u.phone || '—'}</td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {u.farmName ? <span>{u.farmName}{u.location ? ` · ${u.location}` : ''}</span> : '—'}
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{u.joined || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>

                          {/* Approve — pending users only */}
                          {!self && status === 'pending' && canManage(u) && (
                            <button className="btn btn-sm"
                              style={{ background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', borderRadius: 6, padding: '3px 8px', fontWeight: 700 }}
                              onClick={() => handleApprove(u)} title="Approve Registration">
                              <i className="fi fi-rr-check" style={{ marginRight: 3 }} />Approve
                            </button>
                          )}

                          {/* Reject — pending users only */}
                          {!self && status === 'pending' && canManage(u) && (
                            <button className="btn btn-sm"
                              style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 6, padding: '3px 8px', fontWeight: 700 }}
                              onClick={() => openRejectModal(u)} title="Reject Registration">
                              <i className="fi fi-rr-cross" style={{ marginRight: 3 }} />Reject
                            </button>
                          )}

                          {/* Edit — non-pending users */}
                          {status !== 'pending' && (
                            <button className="btn btn-outline btn-sm" onClick={() => openEdit(u)} title="Edit user">
                              <i className="fi fi-rr-edit" />
                            </button>
                          )}

                          {/* Role change — owner only */}
                          {isOwner && !self && u.role !== 'owner' && status !== 'pending' && (
                            <button className="btn btn-outline btn-sm" onClick={() => openRoleModal(u)} title="Change Role">
                              <i className="fi fi-rr-user-gear" />
                            </button>
                          )}

                          {/* SUSPEND (Block) — active users, not self, can manage
                              Suspend = user is blocked / unauthorized to login */}
                          {!self && canManage(u) && status === 'active' && (
                            <button className="btn btn-sm"
                              style={{ background: '#ffedd5', color: '#c2410c', border: '1px solid #fed7aa', borderRadius: 6, padding: '3px 8px' }}
                              onClick={() => handleSuspend(u)}
                              title="Block user — user will be unauthorized to login">
                              <i className="fi fi-rr-ban" />
                            </button>
                          )}

                          {/* ACTIVE / DEACTIVATE toggle — single icon
                              If active → click to deactivate (turn off)
                              If deactivated/suspended → click to activate (turn on) */}
                          {!self && canManage(u) && status !== 'pending' && (
                            status === 'active' ? (
                              /* Currently active → clicking deactivates */
                              <button className="btn btn-sm"
                                style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, padding: '3px 8px' }}
                                onClick={() => handleDeactivate(u)}
                                title="Deactivate — turn off this account">
                                <i className="fi fi-rr-toggle-on" style={{ color: '#22c55e' }} />
                              </button>
                            ) : (status === 'deactivated' || status === 'suspended') ? (
                              /* Currently off → clicking activates */
                              <button className="btn btn-sm"
                                style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, padding: '3px 8px' }}
                                onClick={() => handleActivate(u)}
                                title="Activate — turn on this account">
                                <i className="fi fi-rr-toggle-off" style={{ color: '#9ca3af' }} />
                              </button>
                            ) : null
                          )}

                          {/* Delete — not self, can manage */}
                          {!self && canManage(u) && (
                            <button className="btn btn-sm"
                              style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 6, padding: '3px 8px' }}
                              onClick={() => handleDelete(u)} title="Delete user permanently">
                              <i className="fi fi-rr-trash" />
                            </button>
                          )}

                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Role change modal */}
      {showRole && actionUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '1.5rem', width: '100%', maxWidth: 380, boxShadow: '0 8px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontWeight: 700, marginBottom: 8 }}><i className="fi fi-rr-user-gear" style={{ marginRight: 8, color: '#7c3aed' }} />Change Role</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 12 }}>Change role for <strong>{actionUser.name}</strong>.</p>
            <div className="form-group">
              <label>New Role</label>
              <select value={newRole} onChange={e => setNewRole(e.target.value)}>
                <option value="labor">Laborer</option>
                <option value="office_manager">Office Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setShowRole(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleRoleChange}><i className="fi fi-rr-check" style={{ marginRight: 4 }} />Save Role</button>
            </div>
          </div>
        </div>
      )}

      {/* Reject registration modal */}
      {showReject && rejectTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '1.5rem', width: '100%', maxWidth: 420, boxShadow: '0 8px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontWeight: 700, marginBottom: 8, color: '#991b1b' }}>
              <i className="fi fi-rr-cross-circle" style={{ marginRight: 8 }} />Reject Registration
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 4 }}>
              You are rejecting the registration request for:
            </p>
            <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', marginBottom: 14 }}>
              <strong>{rejectTarget.name}</strong>
              <span style={{ fontSize: '0.8rem', color: '#6b7280', marginLeft: 8 }}>{rejectTarget.email}</span>
            </div>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700 }}>Reason (optional — will be sent to the user)</label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="e.g. Incomplete information provided, please contact the administrator."
                rows={3}
                maxLength={300}
                style={{ width: '100%', padding: '0.6rem', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: '0.85rem', resize: 'vertical', boxSizing: 'border-box' }}
              />
              <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{rejectReason.length}/300</span>
            </div>
            <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: '0.8rem', color: '#92400e' }}>
              <i className="fi fi-rr-info" style={{ marginRight: 5 }} />
              A rejection email will be sent to the user. This action cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setShowReject(false)}>Cancel</button>
              <button className="btn btn-sm" style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, padding: '0.5rem 1rem', fontWeight: 700, cursor: 'pointer' }} onClick={handleReject}>
                <i className="fi fi-rr-cross-circle" style={{ marginRight: 4 }} />Reject Registration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
