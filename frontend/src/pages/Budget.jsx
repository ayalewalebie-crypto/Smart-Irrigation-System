import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { budgetApi, formatETB } from '../services/api';

const CATEGORY_ICONS = {
  salaries:'fi-rr-users-alt', seeds:'fi-rr-leaf', fertilizer:'fi-rr-flask',
  irrigation:'fi-rr-tint', fuel:'fi-rr-gas-pump', equipment:'fi-rr-tools',
  maintenance:'fi-rr-wrench', transport:'fi-rr-truck', farm_operations:'fi-rr-seedling', other:'fi-rr-box-open',
};
const SEASON_LABELS = { kiremt:'Kiremt (Jun–Sep)', bega:'Bega (Oct–Jan)', belg:'Belg (Feb–May)', tsedey:'Tsedey' };

const emptyForm = {
  title:'', type:'annual', year: new Date().getFullYear(),
  month:'', season:'', totalBudget:'', revenueTarget:'', notes:'',
  categories: [
    { name:'salaries',        label:'Employee Salaries', allocated:'', used:0 },
    { name:'seeds',           label:'Seeds',             allocated:'', used:0 },
    { name:'fertilizer',      label:'Fertilizer',        allocated:'', used:0 },
    { name:'irrigation',      label:'Irrigation',        allocated:'', used:0 },
    { name:'fuel',            label:'Fuel',              allocated:'', used:0 },
    { name:'equipment',       label:'Equipment',         allocated:'', used:0 },
    { name:'maintenance',     label:'Maintenance',       allocated:'', used:0 },
    { name:'transport',       label:'Transport',         allocated:'', used:0 },
    { name:'farm_operations', label:'Farm Operations',   allocated:'', used:0 },
    { name:'other',           label:'Other Expenses',    allocated:'', used:0 },
  ],
};

export default function Budget() {
  const { user } = useAuth();
  const { t }    = useLang();
  const isOwner  = user?.role === 'owner';
  const [budgets, setBudgets] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState(null);
  const [form,     setForm]     = useState(emptyForm);
  const [saving,   setSaving]   = useState(false);
  const [filterType, setFilterType] = useState('');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [selected,   setSelected]   = useState(null);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [list, sum] = await Promise.all([
        budgetApi.getAll({ type: filterType||undefined, year: filterYear }),
        budgetApi.getSummary(filterYear),
      ]);
      setBudgets(list); setSummary(sum);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filterType, filterYear]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, year: filterYear });
    setShowForm(true);
  };
  const openEdit = (b) => {
    setEditing(b);
    setForm({
      title: b.title, type: b.type, year: b.year,
      month: b.month||'', season: b.season||'',
      totalBudget: b.totalBudget, revenueTarget: b.revenueTarget||'', notes: b.notes||'',
      categories: b.categories.map(c => ({ ...c, allocated: c.allocated||0 })),
    });
    setShowForm(true);
  };

  const handleCatChange = (idx, val) => {
    setForm(f => {
      const cats = [...f.categories];
      cats[idx] = { ...cats[idx], allocated: val };
      return { ...f, categories: cats };
    });
  };

  const handleSave = async () => {
    if (!form.title || !form.totalBudget) return;
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        totalBudget:    parseFloat(form.totalBudget),
        revenueTarget:  form.revenueTarget ? parseFloat(form.revenueTarget) : 0,
        month: form.month ? parseInt(form.month) : undefined,
        categories: form.categories.map(c => ({ ...c, allocated: parseFloat(c.allocated)||0 })),
      };
      if (editing) await budgetApi.update(editing._id||editing.id, payload);
      else          await budgetApi.create(payload);
      setSuccess(editing ? 'Budget updated!' : 'Budget created!');
      setShowForm(false);
      load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleApprove = async (id) => {
    try { await budgetApi.approve(id); setSuccess('Budget approved and activated!'); load(); }
    catch (e) { setError(e.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this budget?')) return;
    try { await budgetApi.remove(id); setSuccess('Budget deleted.'); load(); }
    catch (e) { setError(e.message); }
  };

  const statusColor = { draft:'#9ca3af', active:'#22c55e', closed:'#6b7280' };

  return (
    <div>
      <div className="page-header">
        <h1><i className="fi fi-rr-coin" style={{ marginRight:8, color:'#7c3aed' }} />Budget Management</h1>
        <div className="header-actions">
          {isOwner && <button className="btn btn-primary" onClick={openCreate}><i className="fi fi-rr-plus" style={{ marginRight:6 }} />Create Budget</button>}
          <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ padding:'0.4rem 0.8rem', borderRadius:6, border:'1px solid var(--border)', fontSize:'0.85rem' }}>
            <option value="">All Types</option>
            <option value="annual">Annual</option>
            <option value="seasonal">Seasonal</option>
            <option value="monthly">Monthly</option>
          </select>
          <select value={filterYear} onChange={e => setFilterYear(e.target.value)} style={{ padding:'0.4rem 0.8rem', borderRadius:6, border:'1px solid var(--border)', fontSize:'0.85rem' }}>
            {[2022,2023,2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {error   && <div className="alert alert-error"   style={{ marginBottom:'0.6rem' }}><i className="fi fi-rr-triangle-warning" style={{ marginRight:6 }} />{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom:'0.6rem' }}><i className="fi fi-rr-check" style={{ marginRight:6 }} />{success}</div>}

      {/* Summary cards */}
      {summary && (
        <div className="stats-grid" style={{ marginBottom:'1rem' }}>
          {[
            { icon:'fi-rr-coin',          label:'Total Budget',    value: formatETB(summary.totalBudget),    color:'' },
            { icon:'fi-rr-chart-pie',     label:'Total Allocated', value: formatETB(summary.totalAllocated), color:'info' },
            { icon:'fi-rr-receipt',       label:'Total Used',      value: formatETB(summary.totalUsed),      color: summary.utilizationPct>90?'danger':summary.utilizationPct>75?'':'' },
            { icon:'fi-rr-check-circle',  label:'Remaining',       value: formatETB(summary.totalBudget - summary.totalUsed), color:'success' },
            { icon:'fi-rr-percentage',    label:'Utilization',     value: `${summary.utilizationPct}%`,     color: summary.utilizationPct>90?'danger':'' },
          ].map(s => (
            <div key={s.label} className={`stat-card${s.color?' '+s.color:''}`}>
              <span className="stat-icon"><i className={`fi ${s.icon}`} /></span>
              <div className="stat-info"><label>{s.label}</label><strong>{s.value}</strong></div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign:'center', padding:'2rem', color:'var(--text-muted)' }}><i className="fi fi-rr-spinner" /> Loading budgets…</div>
      ) : budgets.length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:'2.5rem' }}>
          <i className="fi fi-rr-coin" style={{ fontSize:'2.5rem', color:'var(--text-muted)' }} />
          <p style={{ marginTop:'0.8rem', color:'var(--text-muted)' }}>No budgets found. {isOwner && 'Create your first budget.'}</p>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
          {budgets.map(b => {
            const totalUsed = b.categories.reduce((s,c) => s+(c.used||0), 0);
            const pct       = b.totalBudget > 0 ? Math.min(Math.round((totalUsed/b.totalBudget)*100),100) : 0;
            const barColor  = pct>90?'#ef4444':pct>75?'#f59e0b':'#22c55e';
            return (
              <div key={b._id||b.id} className="card" style={{ borderLeft:`4px solid ${statusColor[b.status]||'#9ca3af'}` }}>
                <div className="card-header">
                  <div>
                    <span style={{ fontWeight:700, fontSize:'1rem' }}>{b.title}</span>
                    <span style={{ marginLeft:10, fontSize:'0.72rem', background:`${statusColor[b.status]}22`, color:statusColor[b.status], border:`1px solid ${statusColor[b.status]}44`, borderRadius:20, padding:'2px 10px', fontWeight:700, textTransform:'capitalize' }}>{b.status}</span>
                    <span style={{ marginLeft:6, fontSize:'0.72rem', color:'var(--text-muted)' }}>{b.type} · {b.year}{b.month?`-${String(b.month).padStart(2,'0')}`:''}
                    {b.season ? ` · ${SEASON_LABELS[b.season]||b.season}` : ''}</span>
                  </div>
                  <div style={{ display:'flex', gap:'0.4rem' }}>
                    {isOwner && b.status==='draft' && <button className="btn btn-sm" style={{ background:'#dcfce7', color:'#166534', border:'1px solid #bbf7d0', borderRadius:6, padding:'3px 12px', fontSize:'0.78rem' }} onClick={() => handleApprove(b._id||b.id)}>Approve</button>}
                    {isOwner && <button className="btn btn-outline btn-sm" onClick={() => openEdit(b)}><i className="fi fi-rr-edit" /></button>}
                    {isOwner && <button className="btn btn-sm" style={{ background:'#fee2e2', color:'#991b1b', border:'1px solid #fecaca', borderRadius:6, padding:'3px 10px' }} onClick={() => handleDelete(b._id||b.id)}><i className="fi fi-rr-trash" /></button>}
                    <button className="btn btn-outline btn-sm" onClick={() => setSelected(selected?._id===b._id?null:b)}><i className={`fi fi-rr-${selected?._id===b._id?'angle-up':'angle-down'}`} /></button>
                  </div>
                </div>

                <div style={{ display:'flex', gap:'1.5rem', flexWrap:'wrap', marginBottom:'0.6rem', fontSize:'0.85rem' }}>
                  <span><strong>{formatETB(b.totalBudget)}</strong> <span style={{ color:'var(--text-muted)' }}>total</span></span>
                  <span style={{ color:barColor }}><strong>{formatETB(totalUsed)}</strong> <span style={{ color:'var(--text-muted)' }}>used ({pct}%)</span></span>
                  <span style={{ color:'#22c55e' }}><strong>{formatETB(b.totalBudget-totalUsed)}</strong> <span style={{ color:'var(--text-muted)' }}>remaining</span></span>
                </div>
                <div style={{ height:8, background:'#e5e7eb', borderRadius:4, marginBottom: selected?._id===b._id?'0.8rem':'0' }}>
                  <div style={{ height:'100%', width:`${pct}%`, background:barColor, borderRadius:4, transition:'width 0.4s' }} />
                </div>

                {selected?._id===b._id && (
                  <div style={{ marginTop:'0.8rem', display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'0.5rem' }}>
                    {b.categories.map(c => {
                      const cp = c.allocated>0?Math.min(Math.round((c.used/c.allocated)*100),100):0;
                      return (
                        <div key={c.name} style={{ padding:'0.5rem', background:'#f9fafb', borderRadius:8, border:'1px solid var(--border)' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                            <i className={`fi ${CATEGORY_ICONS[c.name]||'fi-rr-box-open'}`} style={{ color:'var(--primary)', fontSize:'0.85rem' }} />
                            <span style={{ fontSize:'0.78rem', fontWeight:600 }}>{c.label}</span>
                          </div>
                          <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginBottom:3 }}>
                            {formatETB(c.used)} / {formatETB(c.allocated)}
                          </div>
                          <div style={{ height:5, background:'#e5e7eb', borderRadius:3 }}>
                            <div style={{ height:'100%', width:`${cp}%`, background: cp>90?'#ef4444':'#22c55e', borderRadius:3 }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'flex-start', justifyContent:'center', overflowY:'auto', padding:'1rem' }}>
          <div style={{ background:'#fff', borderRadius:14, padding:'1.5rem', width:'100%', maxWidth:640, marginTop:'2rem', boxShadow:'0 8px 40px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize:'1.1rem', fontWeight:700, marginBottom:'1rem' }}>
              <i className="fi fi-rr-coin" style={{ marginRight:8, color:'#7c3aed' }} />{editing?'Edit Budget':'Create New Budget'}
            </h2>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.8rem' }}>
              <div className="form-group" style={{ gridColumn:'1/-1' }}>
                <label>Budget Title *</label>
                <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Annual Budget 2025" />
              </div>
              <div className="form-group">
                <label>Type *</label>
                <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                  <option value="annual">Annual</option>
                  <option value="seasonal">Seasonal</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div className="form-group">
                <label>Year *</label>
                <input type="number" value={form.year} onChange={e=>setForm(f=>({...f,year:parseInt(e.target.value)}))} min="2020" max="2030" />
              </div>
              {form.type==='monthly' && (
                <div className="form-group">
                  <label>Month</label>
                  <select value={form.month} onChange={e=>setForm(f=>({...f,month:e.target.value}))}>
                    <option value="">Select month</option>
                    {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m,i) => <option key={i} value={i+1}>{m}</option>)}
                  </select>
                </div>
              )}
              {form.type==='seasonal' && (
                <div className="form-group">
                  <label>Season</label>
                  <select value={form.season} onChange={e=>setForm(f=>({...f,season:e.target.value}))}>
                    <option value="">Select season</option>
                    {Object.entries(SEASON_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              )}
              <div className="form-group" style={{ gridColumn:'1/-1' }}>
                <label>Total Budget (ETB) *</label>
                <input type="number" value={form.totalBudget} onChange={e=>setForm(f=>({...f,totalBudget:e.target.value}))} placeholder="0.00" min="0" step="0.01" />
              </div>
              <div className="form-group" style={{ gridColumn:'1/-1' }}>
                <label>Revenue Target (ETB) <span style={{ fontWeight:400, color:'var(--text-muted)', fontSize:'0.78rem' }}>— expected income for this period</span></label>
                <input type="number" value={form.revenueTarget} onChange={e=>setForm(f=>({...f,revenueTarget:e.target.value}))} placeholder="0.00" min="0" step="0.01" />
              </div>
            </div>

            <div style={{ marginTop:'0.6rem', marginBottom:'0.8rem' }}>
              <label style={{ fontSize:'0.82rem', fontWeight:700, color:'var(--text-muted)', display:'block', marginBottom:'0.4rem' }}>Budget Allocation per Category (ETB)</label>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'0.5rem' }}>
                {form.categories.map((c,i) => (
                  <div key={c.name} className="form-group" style={{ margin:0 }}>
                    <label style={{ fontSize:'0.78rem' }}><i className={`fi ${CATEGORY_ICONS[c.name]||'fi-rr-box-open'}`} style={{ marginRight:4 }} />{c.label}</label>
                    <input type="number" value={c.allocated} onChange={e=>handleCatChange(i,e.target.value)} placeholder="0" min="0" step="0.01" />
                  </div>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Notes</label>
              <textarea rows={2} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Optional notes…" style={{ resize:'vertical', width:'100%', padding:'0.5rem', borderRadius:6, border:'1px solid var(--border)', fontSize:'0.88rem' }} />
            </div>

            <div style={{ display:'flex', gap:'0.5rem', justifyContent:'flex-end', marginTop:'0.5rem' }}>
              <button className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <i className="fi fi-rr-spinner" /> : <><i className="fi fi-rr-check" style={{ marginRight:4 }} />{editing?'Save Changes':'Create Budget'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
