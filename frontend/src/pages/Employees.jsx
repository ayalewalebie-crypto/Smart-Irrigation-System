import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { employeeApi, zoneApi, payrollApi, formatETB } from '../services/api';

const ETHIOPIAN_BANKS = [
  { id: 656,  name: 'Commercial Bank of Ethiopia (CBE)' },
  { id: 655,  name: 'Awash Bank' },
  { id: 654,  name: 'Dashen Bank' },
  { id: 653,  name: 'Bank of Abyssinia' },
  { id: 652,  name: 'Wegagen Bank' },
  { id: 651,  name: 'United Bank' },
  { id: 650,  name: 'Nib International Bank' },
  { id: 649,  name: 'Lion International Bank' },
  { id: 648,  name: 'Cooperative Bank of Oromia (CBO)' },
  { id: 647,  name: 'Oromia Bank' },
  { id: 646,  name: 'Zemen Bank' },
  { id: 645,  name: 'Bunna International Bank' },
  { id: 644,  name: 'Berhan International Bank' },
  { id: 643,  name: 'Abay Bank' },
  { id: 642,  name: 'Addis International Bank' },
  { id: 641,  name: 'Development Bank of Ethiopia (DBE)' },
  { id: 640,  name: 'Enat Bank' },
  { id: 639,  name: 'Amhara Bank' },
  { id: 638,  name: 'Telebirr (Ethio Telecom)' },
  { id: 637,  name: 'HelloCash (Somtel)' },
  { id: 636,  name: 'M-PESA' },
];

// Roles that can have employee profiles (owner is excluded — not an employee)
const EMPLOYEE_ROLES = [
  { key:'admin',          label:'Admin',          color:'#ef4444', icon:'fi-rr-shield-check'  },
  { key:'office_manager', label:'Office Manager', color:'#0891b2', icon:'fi-rr-briefcase'     },
  { key:'labor',          label:'Laborer',        color:'#2563eb', icon:'fi-rr-helmet-safety' },
];
const ROLE_COLOR  = { admin:'#ef4444', office_manager:'#0891b2', labor:'#2563eb' };
const EMP_TYPES   = ['permanent','contract','part_time','seasonal'];
const PW_REGEX    = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\-_=+[\]{};':"\\|,.<>/?]).{8,}$/;
const EMPTY = {
  employeeId:'',
  department:'', jobTitle:'', employmentType:'permanent',
  baseSalary:'', assignedFarm:'',
  bankName:'', bankAccount:'',
};

export default function Employees() {
  const { user } = useAuth();
  const { t }    = useLang();
  const myRole    = user?.role;
  // Only Owner can add employee information
  // Office Manager and Admin can view and edit existing employees only
  const canCreate = myRole === 'owner';
  const canEdit   = ['owner', 'admin', 'office_manager'].includes(myRole);
  const canToggle = ['owner', 'office_manager'].includes(myRole);
  const canDelete = myRole === 'owner';

  const [employees,    setEmployees]    = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]); // Users without employee records
  const [zones,        setZones]        = useState([]); // Available farms for assignment
  const [total,        setTotal]        = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [success,      setSuccess]      = useState('');
  const [filterRole,   setFilterRole]   = useState('');
  const [filterActive, setFilterActive] = useState('');
  const [search,       setSearch]       = useState('');
  const [page,         setPage]         = useState(1);
  const [showForm,     setShowForm]     = useState(false);
  const [editing,      setEditing]      = useState(null);
  const [form,         setForm]         = useState(EMPTY);
  const [saving,       setSaving]       = useState(false);
  const [showPw,       setShowPw]       = useState(false);
  const [detail,       setDetail]       = useState(null);
  const [banks,        setBanks]        = useState([]);  // Chapa banks list
  const [banksLoading, setBanksLoading] = useState(false);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const p = { page, limit: 20 };
      if (filterRole)         p.role     = filterRole;
      if (filterActive !== '') p.isActive = filterActive;
      const res = await employeeApi.getAll(p);
      setEmployees(res?.employees || []);
      setTotal(res?.total || 0);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  
  // Load active employees (for dropdown)
  const loadAvailableUsers = async () => {
    try {
      // Fetch all active employees
      const res = await employeeApi.getAll({ isActive: true, limit: 200 });
      const emps = res?.employees || [];
      setAvailableUsers(emps);
    } catch (e) {
      console.error('Failed to load employees:', e);
    }
  };
  
  // Load zones/farms for assignment
  const loadZones = async () => {
    try {
      const data = await zoneApi.getAll();
      setZones(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load zones:', e);
    }
  };

  // Load Chapa supported banks — static list always available, live API enriches it
  const loadBanks = async () => {
    // Always show static list immediately
    if (banks.length === 0) setBanks(ETHIOPIAN_BANKS);
    // Try to enrich with live Chapa data
    try {
      const res = await payrollApi.getBanks();
      if (Array.isArray(res?.banks) && res.banks.length > 0) {
        setBanks(res.banks);
      }
    } catch (_) {
      // Static list already shown — no error displayed
    } finally {
      setBanksLoading(false);
    }
  };

  useEffect(() => { load(); }, [filterRole, filterActive, page]);
  useEffect(() => {
    if (showForm) {
      loadZones();
      loadBanks();
      if (canCreate && !editing) loadAvailableUsers();
    }
  }, [showForm, editing]);

  const openCreate = () => {
    setEditing(null); setForm(EMPTY); setError(''); setShowPw(false); setShowForm(true);
  };
  const openEdit = (emp) => {
    setEditing(emp);
    setForm({
      employeeId:     emp._id || emp.id,
      department:     emp.department     || '',
      jobTitle:       emp.jobTitle       || '',
      employmentType: emp.employmentType || 'permanent',
      baseSalary:     emp.baseSalary     || '',
      assignedFarm:   emp.assignedFarm   || '',
      bankName:       emp.bankName       || '',
      bankAccount:    emp.bankAccount    || '',
    });
    setError(''); setShowPw(false); setShowForm(true);
  };

  const handleSave = async () => {
    setError('');
    if (!editing && !form.employeeId) { setError('Please select an employee.'); return; }
    
    setSaving(true);
    try {
      const payload = { ...form };
      delete payload.employeeId; // Don't send employee ID in payload
      
      const employeeId = editing ? (editing._id || editing.id) : form.employeeId;
      await employeeApi.update(employeeId, payload);
      setSuccess('Employee information updated successfully!');
      setShowForm(false); load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleToggle = async (emp) => {
    try {
      await employeeApi.toggleActive(emp._id || emp.id);
      setSuccess(`${emp.name} ${emp.isActive ? 'deactivated' : 'activated'}.`);
      load();
    } catch (e) { setError(e.message); }
  };

  const handleDelete = async (emp) => {
    if (!confirm(`Delete "${emp.name}"?\nThis also deletes their login account. Cannot be undone.`)) return;
    try { await employeeApi.remove(emp._id || emp.id); setSuccess('Employee and login account deleted.'); load(); }
    catch (e) { setError(e.message); }
  };

  const f = (field) => (e) => { setForm(p => ({ ...p, [field]: e.target.value })); setError(''); };
  const visible = employees.filter(e =>
    !search ||
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.email.toLowerCase().includes(search.toLowerCase()) ||
    (e.employeeId||'').toLowerCase().includes(search.toLowerCase())
  );
  const cnt = EMPLOYEE_ROLES.reduce(
    (a,r) => ({ ...a, [r.key]: employees.filter(e=>e.role===r.key).length }),
    {}
  );

  return (
    <div>
      <div className="page-header">
        <h1><i className="fi fi-rr-id-badge" style={{marginRight:8,color:'var(--primary)'}}/>
          {t('employeeManagement')}
        </h1>
        <div className="header-actions">
          {canCreate && (
            <button className="btn btn-primary" onClick={openCreate}>
              <i className="fi fi-rr-user-add" style={{marginRight:6}}/>{t('addEmployeeInfo')}
            </button>
          )}
          <input placeholder="Search name / email / ID…" value={search} onChange={e=>setSearch(e.target.value)}
            style={{padding:'0.4rem 0.8rem',borderRadius:6,border:'1px solid var(--border)',fontSize:'0.85rem',minWidth:200}}/>
          <select value={filterRole} onChange={e=>{setFilterRole(e.target.value);setPage(1);}}
            style={{padding:'0.4rem 0.6rem',borderRadius:6,border:'1px solid var(--border)',fontSize:'0.85rem'}}>
            <option value="">All Roles</option>
            {EMPLOYEE_ROLES.map(r=><option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
          <select value={filterActive} onChange={e=>{setFilterActive(e.target.value);setPage(1);}}
            style={{padding:'0.4rem 0.6rem',borderRadius:6,border:'1px solid var(--border)',fontSize:'0.85rem'}}>
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          <button className="btn btn-outline btn-sm" onClick={load}><i className="fi fi-rr-refresh"/></button>
        </div>
      </div>

      {error   && <div className="alert alert-error"   style={{marginBottom:'0.6rem'}}><i className="fi fi-rr-triangle-warning" style={{marginRight:6}}/>{error}</div>}
      {success && <div className="alert alert-success" style={{marginBottom:'0.6rem'}}><i className="fi fi-rr-check" style={{marginRight:6}}/>{success}</div>}

      <div className="stats-grid" style={{marginBottom:'1rem'}}>
        <div className="stat-card">
          <span className="stat-icon"><i className="fi fi-rr-users-alt"/></span>
          <div className="stat-info"><label>Total Employees</label><strong>{total}</strong><span>excl. owner</span></div>
        </div>
        {EMPLOYEE_ROLES.map(r=>(
          <div key={r.key} className="stat-card" style={{borderLeftColor:r.color,cursor:'pointer'}}
            onClick={()=>{setFilterRole(r.key);setPage(1);}}>
            <span className="stat-icon"><i className={`fi ${r.icon}`} style={{color:r.color}}/></span>
            <div className="stat-info"><label>{r.label}</label><strong>{cnt[r.key]||0}</strong></div>
          </div>
        ))}
        <div className="stat-card success">
          <span className="stat-icon"><i className="fi fi-rr-check-circle"/></span>
          <div className="stat-info"><label>Active</label><strong>{employees.filter(e=>e.isActive).length}</strong></div>
        </div>
        <div className="stat-card danger">
          <span className="stat-icon"><i className="fi fi-rr-user-remove"/></span>
          <div className="stat-info"><label>Inactive</label><strong>{employees.filter(e=>!e.isActive).length}</strong></div>
        </div>
      </div>

      {loading ? (
        <div style={{textAlign:'center',padding:'2.5rem',color:'var(--text-muted)'}}>
          <i className="fi fi-rr-spinner" style={{fontSize:'1.5rem'}}/><p style={{marginTop:8}}>Loading employees…</p>
        </div>
      ) : visible.length===0 ? (
        <div className="card" style={{textAlign:'center',padding:'3rem'}}>
          <i className="fi fi-rr-users-alt" style={{fontSize:'2.5rem',color:'var(--text-muted)'}}/>
          <p style={{marginTop:'0.8rem',color:'var(--text-muted)'}}>
          {canCreate ? `${t('noRecords')} ${t('add')} ${t('employees')} ${t('to')} ${t('start')}.` : t('noRecords')}
          </p>        </div>
      ) : (
        <div className="card" style={{padding:0,overflow:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.84rem'}}>
            <thead>
              <tr style={{background:'#f9fafb',borderBottom:'2px solid var(--border)'}}>
                {['ID','Name & Email','Role','Department','Job Title','Start Date','Salary (ETB)','Status','Actions'].map(h=>(
                  <th key={h} style={{padding:'0.65rem 0.8rem',textAlign:'left',fontWeight:700,color:'var(--text-muted)',fontSize:'0.75rem',whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(emp=>(
                <tr key={emp._id||emp.id} style={{borderBottom:'1px solid var(--border)'}} className="table-row-hover">
                  <td style={{padding:'0.6rem 0.8rem',fontFamily:'monospace',fontSize:'0.74rem',color:'var(--text-muted)'}}>{emp.employeeId||'—'}</td>
                  <td style={{padding:'0.6rem 0.8rem'}}>
                    <div style={{fontWeight:600}}>{emp.name}</div>
                    <div style={{fontSize:'0.72rem',color:'var(--text-muted)'}}>{emp.email}</div>
                  </td>
                  <td style={{padding:'0.6rem 0.8rem'}}>
                    <span style={{fontSize:'0.72rem',fontWeight:700,borderRadius:20,padding:'2px 10px',
                      background:(ROLE_COLOR[emp.role]||'#6b7280')+'22',
                      color:ROLE_COLOR[emp.role]||'#6b7280',
                      border:`1px solid ${ROLE_COLOR[emp.role]||'#6b7280'}44`}}>
                      {emp.role==='office_manager'?'Office Mgr':emp.role==='labor'?'Laborer':emp.role}
                    </span>
                  </td>
                  <td style={{padding:'0.6rem 0.8rem',color:'var(--text-muted)'}}>{emp.department||'—'}</td>
                  <td style={{padding:'0.6rem 0.8rem',color:'var(--text-muted)'}}>{emp.jobTitle||'—'}</td>
                  <td style={{padding:'0.6rem 0.8rem',whiteSpace:'nowrap'}}>
                    {emp.startDate ? new Date(emp.startDate).toLocaleDateString() : '—'}
                  </td>
                  <td style={{padding:'0.6rem 0.8rem',fontWeight:600}}>
                    {emp.baseSalary ? formatETB(emp.baseSalary) : '—'}
                  </td>
                  <td style={{padding:'0.6rem 0.8rem'}}>
                    <div style={{display:'flex',flexDirection:'column',gap:3}}>
                      <span style={{fontSize:'0.72rem',fontWeight:700,borderRadius:20,padding:'2px 10px',width:'fit-content',
                        background:emp.isActive?'#dcfce7':'#fee2e2',
                        color:emp.isActive?'#166534':'#991b1b'}}>
                        {emp.isActive?'Active':'Inactive'}
                      </span>
                      <span style={{fontSize:'0.65rem',fontWeight:700,borderRadius:20,padding:'2px 7px',width:'fit-content',
                        background: emp.bankAccount && emp.bankName ? '#f5f3ff' : '#f9fafb',
                        color:      emp.bankAccount && emp.bankName ? '#7c3aed' : '#9ca3af',
                        border:     `1px solid ${emp.bankAccount && emp.bankName ? '#c4b5fd' : '#e5e7eb'}`}}>
                        <i className="fi fi-rr-paper-plane" style={{marginRight:3}}/>
                        {emp.bankAccount && emp.bankName ? 'Chapa ✓' : 'No Chapa'}
                      </span>
                    </div>
                  </td>
                  <td style={{padding:'0.6rem 0.8rem',whiteSpace:'nowrap',display:'flex',gap:4}}>
                    <button className="btn btn-outline btn-sm" onClick={()=>setDetail(emp)} title="View">
                      <i className="fi fi-rr-eye"/>
                    </button>
                    {canEdit && (
                      <button className="btn btn-outline btn-sm" onClick={()=>openEdit(emp)} title="Edit">
                        <i className="fi fi-rr-edit"/>
                      </button>
                    )}
                    {canToggle && (
                      <button className="btn btn-sm" title={emp.isActive?'Deactivate':'Activate'}
                        style={{background:emp.isActive?'#fef3c7':'#dcfce7',
                          color:emp.isActive?'#92400e':'#166534',
                          border:'1px solid',borderColor:emp.isActive?'#fde68a':'#bbf7d0',
                          borderRadius:6,padding:'3px 8px'}}
                        onClick={()=>handleToggle(emp)}>
                        <i className={`fi ${emp.isActive?'fi-rr-pause-circle':'fi-rr-play-circle'}`}/>
                      </button>
                    )}
                    {canDelete && (
                      <button className="btn btn-sm"
                        style={{background:'#fee2e2',color:'#991b1b',border:'1px solid #fecaca',borderRadius:6,padding:'3px 8px'}}
                        onClick={()=>handleDelete(emp)} title="Delete Employee & Account">
                        <i className="fi fi-rr-trash"/>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 20 && (
        <div style={{display:'flex',justifyContent:'center',gap:'0.5rem',marginTop:'1rem'}}>
          <button className="btn btn-outline btn-sm" disabled={page===1} onClick={()=>setPage(p=>p-1)}>← Prev</button>
          <span style={{padding:'0.4rem 0.8rem',fontSize:'0.85rem',color:'var(--text-muted)'}}>
            Page {page} of {Math.ceil(total/20)}
          </span>
          <button className="btn btn-outline btn-sm" disabled={employees.length<20} onClick={()=>setPage(p=>p+1)}>Next →</button>
        </div>
      )}

      {detail && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem',overflowY:'auto'}}>
          <div style={{background:'#fff',borderRadius:14,padding:'1.5rem',width:'100%',maxWidth:520,boxShadow:'0 8px 40px rgba(0,0,0,0.2)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
              <h3 style={{fontWeight:700,fontSize:'1.05rem'}}>
                <i className="fi fi-rr-user" style={{marginRight:8,color:ROLE_COLOR[detail.role]||'var(--primary)'}}/>
                {detail.name}
                <span style={{marginLeft:8,fontSize:'0.72rem',fontWeight:700,borderRadius:20,padding:'2px 10px',
                  background:(ROLE_COLOR[detail.role]||'#6b7280')+'22',
                  color:ROLE_COLOR[detail.role]||'#6b7280'}}>
                  {detail.role}
                </span>
              </h3>
              <button className="btn btn-outline btn-sm" onClick={()=>setDetail(null)}><i className="fi fi-rr-cross"/></button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem',fontSize:'0.85rem'}}>
              {[
                ['Employee ID',  detail.employeeId||'—'],
                ['Email',        detail.email],
                ['Phone',        detail.phone||'—'],
                ['Department',   detail.department||'—'],
                ['Job Title',    detail.jobTitle||'—'],
                ['Employment',   (detail.employmentType||'—').replace('_',' ')],
                ['Start Date',   detail.startDate?new Date(detail.startDate).toLocaleDateString():'—'],
                ['Salary (ETB)', detail.baseSalary?formatETB(detail.baseSalary):'—'],
                ['Assigned Farm',detail.assignedFarm||'—'],
                ['Status',       detail.isActive?'Active':'Inactive'],
              ].map(([k,v])=>(
                <div key={k} style={{padding:'0.4rem 0.6rem',background:'#f9fafb',borderRadius:6}}>
                  <div style={{fontSize:'0.7rem',color:'var(--text-muted)'}}>{k}</div>
                  <div style={{fontWeight:600}}>{v}</div>
                </div>
              ))}
            </div>

            {/* Chapa payment info */}
            <div style={{marginTop:'0.8rem',background:'#f5f3ff',border:'1px solid #c4b5fd',borderRadius:8,padding:'0.7rem 0.9rem'}}>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:'0.5rem'}}>
                <span style={{background:'linear-gradient(135deg,#7c3aed,#6d28d9)',borderRadius:5,padding:'2px 8px',display:'inline-flex',alignItems:'center',gap:4}}>
                  <i className="fi fi-rr-paper-plane" style={{color:'#fff',fontSize:'0.7rem'}}/>
                  <span style={{color:'#fff',fontWeight:700,fontSize:'0.68rem'}}>CHAPA</span>
                </span>
                <span style={{fontWeight:700,fontSize:'0.8rem',color:'#5b21b6'}}>Payment Info</span>
                {detail.bankAccount && detail.bankName
                  ? <span style={{marginLeft:'auto',background:'#dcfce7',color:'#166534',fontSize:'0.68rem',fontWeight:700,padding:'2px 8px',borderRadius:20}}>✓ Ready</span>
                  : <span style={{marginLeft:'auto',background:'#fee2e2',color:'#991b1b',fontSize:'0.68rem',fontWeight:700,padding:'2px 8px',borderRadius:20}}>⚠ Incomplete</span>
                }
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.4rem',fontSize:'0.82rem'}}>
                {[
                  ['Bank',        detail.bankName||'—'],
                  ['Account No',  detail.bankAccount ? '••••' + String(detail.bankAccount).slice(-4) : '—'],
                ].map(([k,v])=>(
                  <div key={k} style={{padding:'0.35rem 0.5rem',background:'rgba(255,255,255,0.7)',borderRadius:6}}>
                    <div style={{fontSize:'0.65rem',color:'#9ca3af'}}>{k}</div>
                    <div style={{fontWeight:600,fontFamily:k==='Account No'?'monospace':'inherit'}}>{v}</div>
                  </div>
                ))}
              </div>
              {(!detail.bankAccount || !detail.bankName) && (
                <p style={{margin:'0.5rem 0 0',fontSize:'0.73rem',color:'#7c3aed'}}>
                  <i className="fi fi-rr-info" style={{marginRight:4}}/>
                  Set bank name and account number to enable Chapa salary payments.
                </p>
              )}
            </div>
            {detail.notes && (
              <p style={{marginTop:'0.8rem',padding:'0.5rem',background:'#f9fafb',borderRadius:6,fontSize:'0.83rem'}}>
                <strong>Notes:</strong> {detail.notes}
              </p>
            )}
          </div>
        </div>
      )}

      {showForm && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'flex-start',justifyContent:'center',overflowY:'auto',padding:'1rem'}}>
          <div style={{background:'#fff',borderRadius:14,padding:'1.5rem',width:'100%',maxWidth:620,marginTop:'2rem',boxShadow:'0 8px 40px rgba(0,0,0,0.2)'}}>
            <h3 style={{fontWeight:700,marginBottom:'0.5rem'}}>
              <i className={`fi ${editing?'fi-rr-edit':'fi-rr-user-add'}`} style={{marginRight:8}}/>
              {editing ? 'Edit Employee Information' : 'Add Employee Information'}
            </h3>
            {!editing && (
              <p style={{fontSize:'0.8rem',color:'#1e40af',marginBottom:'1rem',padding:'0.5rem 0.8rem',background:'#eff6ff',borderRadius:6,border:'1px solid #bfdbfe'}}>
                <i className="fi fi-rr-info" style={{marginRight:5}}/>
                Select an employee to complete/update their HR information.
              </p>
            )}
            {error && (
              <div className="alert alert-error" style={{marginBottom:'0.8rem'}}>
                <i className="fi fi-rr-triangle-warning" style={{marginRight:6}}/>{error}
              </div>
            )}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.7rem'}}>
              {!editing && (
                <div className="form-group" style={{gridColumn:'1/-1'}}>
                  <label>Select Employee <span style={{color:'#ef4444'}}>*</span></label>
                  <select value={form.employeeId} onChange={f('employeeId')}>
                    <option value="">-- Select an employee --</option>
                    {availableUsers.map(emp => (
                      <option key={emp._id} value={emp._id}>
                        {emp.name}
                      </option>
                    ))}
                  </select>
                  <span style={{fontSize:'0.7rem',color:'var(--text-muted)',marginTop:3,display:'block'}}>
                    Select an active employee to add/update their HR information.
                  </span>
                </div>
              )}
              {editing && (
                <div className="form-group" style={{gridColumn:'1/-1',padding:'0.6rem 0.8rem',background:'#f9fafb',borderRadius:6}}>
                  <div style={{fontSize:'0.75rem',color:'var(--text-muted)'}}>Employee</div>
                  <div style={{fontWeight:600,fontSize:'0.95rem'}}>{editing.employeeId} — {editing.name} ({editing.email})</div>
                </div>
              )}
              <div className="form-group">
                <label>Department</label>
                <input value={form.department} onChange={f('department')} placeholder="e.g. Field Operations"/>
              </div>
              <div className="form-group">
                <label>Job Title</label>
                <input value={form.jobTitle} onChange={f('jobTitle')} placeholder="e.g. Senior Farmer"/>
              </div>
              <div className="form-group">
                <label>Employment Type</label>
                <select value={form.employmentType} onChange={f('employmentType')}>
                  {EMP_TYPES.map(t=><option key={t} value={t}>{t.replace('_',' ')}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Basic Salary (ETB)</label>
                <input type="number" value={form.baseSalary} onChange={f('baseSalary')} placeholder="0.00" min="0" step="0.01"/>
              </div>
              {/* Assigned Farm - Only for Laborers */}
              {(editing?.role === 'labor' || (!editing && availableUsers.find(e => e._id === form.employeeId)?.role === 'labor')) && (
                <div className="form-group" style={{gridColumn:'1/-1'}}>
                  <label>Assigned Farm</label>
                  <select value={form.assignedFarm} onChange={f('assignedFarm')}>
                    <option value="">-- No farm assigned --</option>
                    {zones.map(z => (
                      <option key={z._id || z.id} value={z.name}>{z.name}</option>
                    ))}
                  </select>
                  <span style={{fontSize:'0.7rem',color:'var(--text-muted)',marginTop:3,display:'block'}}>
                    Assign this laborer to a specific farm zone.
                  </span>
                </div>
              )}

              {/* ── Chapa Payment Setup ─────────────────────────────── */}
              <div style={{gridColumn:'1/-1',marginTop:'0.5rem',paddingTop:'0.75rem',borderTop:'1px solid var(--border)'}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:'0.6rem'}}>
                  <span style={{background:'linear-gradient(135deg,#7c3aed,#6d28d9)',borderRadius:6,padding:'3px 8px',display:'inline-flex',alignItems:'center',gap:5}}>
                    <i className="fi fi-rr-paper-plane" style={{color:'#fff',fontSize:'0.75rem'}}/>
                    <span style={{color:'#fff',fontWeight:700,fontSize:'0.72rem'}}>CHAPA</span>
                  </span>
                  <span style={{fontWeight:700,fontSize:'0.88rem',color:'#374151'}}>Payment Setup</span>
                </div>
                <div style={{background:'#f5f3ff',border:'1px solid #c4b5fd',borderRadius:8,padding:'0.5rem 0.8rem',marginBottom:'0.75rem',fontSize:'0.75rem',color:'#5b21b6'}}>
                  <i className="fi fi-rr-info" style={{marginRight:5}}/>
                  Salary is paid via <strong>Chapa only</strong>. Set the employee's Chapa-supported bank and account number to enable payments.
                </div>
              </div>

              <div className="form-group">
                <label>Bank Name (Chapa)</label>
                <select
                  value={form.bankName}
                  onChange={e => { setForm(p => ({ ...p, bankName: e.target.value })); setError(''); }}
                >
                  <option value="">-- Select bank --</option>
                  {banks.map(b => (
                    <option key={b.id} value={b.name}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Account Number</label>
                <input
                  value={form.bankAccount}
                  onChange={f('bankAccount')}
                  placeholder="e.g. 1000123456789"
                  style={{fontFamily:'monospace',letterSpacing:'0.05em'}}
                />
                <span style={{fontSize:'0.7rem',color:'var(--text-muted)',marginTop:3,display:'block'}}>
                  Employee's bank account number for Chapa salary transfer.
                </span>
              </div>
            </div>
            <div style={{display:'flex',gap:'0.5rem',justifyContent:'flex-end',marginTop:'0.8rem'}}>
              <button className="btn btn-outline" onClick={()=>setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving
                  ? <><i className="fi fi-rr-spinner" style={{marginRight:5}}/>Saving…</>
                  : <><i className="fi fi-rr-check" style={{marginRight:5}}/>{editing?'Update Information':'Add Information'}</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
