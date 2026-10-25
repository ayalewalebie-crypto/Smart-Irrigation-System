import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { expenseApi, formatETB } from '../services/api';

const STATUS_META = {
  draft:     { label:'Draft',     color:'#9ca3af', bg:'#f3f4f6', border:'#e5e7eb' },
  submitted: { label:'Submitted', color:'#d97706', bg:'#fffbeb', border:'#fcd34d' },
  approved:  { label:'Approved',  color:'#1d4ed8', bg:'#eff6ff', border:'#93c5fd' },
  paid:      { label:'Paid',      color:'#16a34a', bg:'#f0fdf4', border:'#86efac' },
  rejected:  { label:'Rejected',  color:'#dc2626', bg:'#fee2e2', border:'#fca5a5' },
};

const CATEGORIES = [
  'salaries','seeds','fertilizer','irrigation','fuel','equipment',
  'maintenance','transport','farm_operations','office','other',
];
const CAT_LABEL = {
  salaries:'Salaries', seeds:'Seeds', fertilizer:'Fertilizer',
  irrigation:'Irrigation', fuel:'Fuel', equipment:'Equipment',
  maintenance:'Maintenance', transport:'Transport',
  farm_operations:'Farm Ops', office:'Office', other:'Other',
};
const CAT_COLOR = {
  salaries:'#ef4444', seeds:'#22c55e', fertilizer:'#84cc16',
  irrigation:'#3b82f6', fuel:'#f97316', equipment:'#8b5cf6',
  maintenance:'#f59e0b', transport:'#14b8a6', farm_operations:'#06b6d4',
  office:'#6b7280', other:'#9ca3af',
};

const emptyForm = {
  title:'', description:'', category:'other', amount:'',
  expenseDate: new Date().toISOString().split('T')[0],
  vendor:'', invoiceNo:'', receiptRef:'', notes:'',
};

const OWNER_THRESHOLD = 50000;

export default function Expenses() {
  const { user } = useAuth();
  const { t }    = useLang();
  const role     = user?.role;

  const canCreate  = ['office_manager','admin','owner'].includes(role);
  const canSubmit  = ['office_manager','admin','owner'].includes(role);
  const canApprove = ['owner','admin'].includes(role);
  const canPay     = ['owner','admin'].includes(role);
  const canDelete  = role === 'owner';

  const [expenses,      setExpenses]      = useState([]);
  const [summary,       setSummary]       = useState(null);
  const [activeBudget,  setActiveBudget]  = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');
  const [success,       setSuccess]       = useState('');
  const [filterStatus,  setFilterStatus]  = useState('');
  const [filterCat,     setFilterCat]     = useState('');
  const [showForm,      setShowForm]      = useState(false);
  const [editing,       setEditing]       = useState(null);
  const [form,          setForm]          = useState(emptyForm);
  const [saving,        setSaving]        = useState(false);
  const [rejectId,      setRejectId]      = useState(null);
  const [rejectReason,  setRejectReason]  = useState('');
  const [page,          setPage]          = useState(1);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const params = { page, limit:20 };
      if (filterStatus) params.status   = filterStatus;
      if (filterCat)    params.category = filterCat;
      const [res, sum] = await Promise.all([
        expenseApi.getAll(params),
        expenseApi.getSummary(),
      ]);
      setExpenses(res?.expenses || []);
      setActiveBudget(res?.activeBudget || null);
      setSummary(sum);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filterStatus, filterCat, page]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setError(''); setShowForm(true); };
  const openEdit   = (e) => {
    setEditing(e);
    setForm({
      title: e.title, description: e.description||'', category: e.category,
      amount: e.amount, expenseDate: new Date(e.expenseDate).toISOString().split('T')[0],
      vendor: e.vendor||'', invoiceNo: e.invoiceNo||'',
      receiptRef: e.receiptRef||'', notes: e.notes||'',
    });
    setError(''); setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim())   { setError('Title is required.'); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { setError('Amount must be greater than 0.'); return; }
    if (!form.expenseDate)    { setError('Expense date is required.'); return; }
    setSaving(true); setError('');
    try {
      if (editing) {
        await expenseApi.update(editing._id||editing.id, form);
        setSuccess('Expense updated!');
      } else {
        await expenseApi.create(form);
        setSuccess('Expense created!');
      }
      setShowForm(false); load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const act = async (fn, id, ...args) => {
    setError(''); setSuccess('');
    try { await fn(id, ...args); setSuccess('Done!'); load(); }
    catch (e) { setError(e.message); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this expense permanently?')) return;
    try { await expenseApi.remove(id); setSuccess('Deleted.'); load(); }
    catch (e) { setError(e.message); }
  };

  // Budget utilization helper
  const getBudgetCat = (catName) => {
    if (!activeBudget) return null;
    return activeBudget.categories?.find(c => c.name === catName) || null;
  };

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1><i className="fi fi-rr-receipt" style={{ marginRight:8, color:'#ef4444' }} />{t('expenseManagement')}</h1>
          {activeBudget && (
            <p style={{ fontSize:'0.78rem', color:'var(--text-muted)', margin:'3px 0 0', display:'flex', alignItems:'center', gap:6 }}>
              <i className="fi fi-rr-coin" style={{ color:'#166534' }} />
              Active Budget: <strong>{activeBudget.title}</strong> — {formatETB(activeBudget.totalBudget)} total
            </p>
          )}
        </div>
        <div className="header-actions">
          {canCreate && (
            <button className="btn btn-primary" onClick={openCreate}>
              <i className="fi fi-rr-plus" style={{ marginRight:6 }} />{t('addExpense')}
            </button>
          )}
          <select value={filterStatus} onChange={e=>{setFilterStatus(e.target.value);setPage(1);}}
            style={{ padding:'0.4rem 0.8rem', borderRadius:6, border:'1px solid var(--border)', fontSize:'0.85rem' }}>
            <option value="">All Status</option>
            {Object.entries(STATUS_META).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={filterCat} onChange={e=>{setFilterCat(e.target.value);setPage(1);}}
            style={{ padding:'0.4rem 0.8rem', borderRadius:6, border:'1px solid var(--border)', fontSize:'0.85rem' }}>
            <option value="">All Categories</option>
            {CATEGORIES.map(c=><option key={c} value={c}>{CAT_LABEL[c]}</option>)}
          </select>
          <button className="btn btn-outline btn-sm" onClick={load}><i className="fi fi-rr-refresh" /></button>
        </div>
      </div>

      {error   && <div className="alert alert-error"   style={{ marginBottom:'0.6rem' }}><i className="fi fi-rr-triangle-warning" style={{ marginRight:6 }} />{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom:'0.6rem' }}><i className="fi fi-rr-check" style={{ marginRight:6 }} />{success}</div>}

      {/* ── Summary cards ── */}
      {summary && (
        <div className="stats-grid" style={{ marginBottom:'1rem' }}>
          {[
            { icon:'fi-rr-receipt',      label:t('totalExpenses'),    value: formatETB(summary.totalAmount), color:'' },
            { icon:'fi-rr-clock',        label:t('pending'),          value: formatETB(summary.pending),     color: summary.pending>0?'warning':'' },
            { icon:'fi-rr-check-circle', label:t('approved'),         value: formatETB(summary.approved),    color:'info' },
            { icon:'fi-rr-badge-check',  label:t('paid'),             value: formatETB(summary.paid),        color:'success' },
            { icon:'fi-rr-chart-pie',    label:t('totalLabel'),       value: summary.count||0,               color:'' },
          ].map(s=>(
            <div key={s.label} className={`stat-card${s.color?' '+s.color:''}`}>
              <span className="stat-icon"><i className={`fi ${s.icon}`} /></span>
              <div className="stat-info"><label>{s.label}</label><strong>{s.value}</strong></div>
            </div>
          ))}
        </div>
      )}

      {/* ── Budget utilization bar (office manager focus) ── */}
      {activeBudget && summary?.byCategory && Object.keys(summary.byCategory).length > 0 && (
        <div className="card" style={{ marginBottom:'1rem' }}>
          <div className="card-header">
            <span className="card-title">
              <i className="fi fi-rr-coin" style={{ marginRight:6, color:'#166534' }} />
              Budget Utilization — {activeBudget.title}
            </span>
            <span style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>
              Total: {formatETB(activeBudget.totalBudget)}
            </span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:'0.5rem' }}>
            {Object.entries(summary.byCategory).map(([cat, spent]) => {
              const budCat   = getBudgetCat(cat);
              const allocated = budCat?.allocated || 0;
              const used      = budCat?.used      || 0;
              const pct       = allocated > 0 ? Math.min(100, Math.round((used / allocated) * 100)) : 0;
              const overBudget = pct > 100;
              const color     = CAT_COLOR[cat] || '#6b7280';
              return (
                <div key={cat} style={{ background:'#f9fafb', borderRadius:8, padding:'0.6rem 0.8rem', border:'1px solid #e5e7eb' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.78rem', marginBottom:4 }}>
                    <span style={{ fontWeight:700, color }}>{CAT_LABEL[cat]||cat}</span>
                    <span style={{ color: overBudget ? '#dc2626' : '#374151', fontWeight:600, fontSize:'0.73rem' }}>
                      {allocated > 0 ? `${pct}%` : 'No budget'}
                    </span>
                  </div>
                  {allocated > 0 && (
                    <div style={{ height:6, background:'#e5e7eb', borderRadius:3, overflow:'hidden', marginBottom:3 }}>
                      <div style={{ height:'100%', width:`${pct}%`, background: overBudget ? '#ef4444' : color, borderRadius:3, transition:'width 0.4s' }} />
                    </div>
                  )}
                  <div style={{ fontSize:'0.68rem', color:'var(--text-muted)', display:'flex', justifyContent:'space-between' }}>
                    <span>Spent: <strong style={{ color }}>{formatETB(spent)}</strong></span>
                    {allocated > 0 && <span>Budget: {formatETB(allocated)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Expense table ── */}
      {loading ? (
        <div style={{ textAlign:'center', padding:'2rem', color:'var(--text-muted)' }}>
          <i className="fi fi-rr-spinner" style={{ fontSize:'1.5rem', display:'block', marginBottom:8 }} />Loading expenses…
        </div>
      ) : expenses.length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:'2.5rem' }}>
          <i className="fi fi-rr-receipt" style={{ fontSize:'2.5rem', color:'var(--text-muted)', display:'block', marginBottom:10 }} />
          <p style={{ color:'var(--text-muted)' }}>No expenses found.</p>
          {canCreate && (
            <button className="btn btn-primary" onClick={openCreate} style={{ marginTop:10 }}>
              <i className="fi fi-rr-plus" style={{ marginRight:6 }} />{t('addExpense')}
            </button>
          )}
        </div>
      ) : (
        <div className="card" style={{ padding:0, overflow:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.84rem' }}>
            <thead>
              <tr style={{ background:'#f9fafb', borderBottom:'2px solid var(--border)' }}>
                {[t('expenseTitle'),t('expenseCategory'),t('date'),t('amount'),'By',t('status'),t('action')].map(h=>(
                  <th key={h} style={{ padding:'0.6rem 0.8rem', textAlign:'left', fontWeight:700, color:'var(--text-muted)', fontSize:'0.75rem', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {expenses.map(e => {
                const sm  = STATUS_META[e.status] || STATUS_META.draft;
                const budCat = getBudgetCat(e.category);
                return (
                  <tr key={e._id||e.id} style={{ borderBottom:'1px solid var(--border)' }} className="table-row-hover">
                    <td style={{ padding:'0.6rem 0.8rem' }}>
                      <div style={{ fontWeight:600 }}>{e.title}</div>
                      {e.vendor && <div style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>{e.vendor}</div>}
                      {e.requiresOwnerApproval && (
                        <span style={{ fontSize:'0.62rem', background:'#f5f3ff', color:'#7c3aed', border:'1px solid #ddd6fe', borderRadius:20, padding:'1px 7px', fontWeight:700 }}>
                          ⚡ {t('owner')} approval
                        </span>
                      )}
                      {budCat && e.status !== 'rejected' && (
                        <div style={{ marginTop:3 }}>
                          <div style={{ height:3, background:'#e5e7eb', borderRadius:2, width:80, overflow:'hidden' }}>
                            <div style={{ height:'100%', background: (budCat.used/budCat.allocated)>1 ? '#ef4444' : CAT_COLOR[e.category]||'#6b7280',
                              width:`${Math.min(100,Math.round((budCat.used/budCat.allocated)*100))}%` }} />
                          </div>
                        </div>
                      )}
                    </td>
                    <td style={{ padding:'0.6rem 0.8rem' }}>
                      <span style={{ fontSize:'0.73rem', fontWeight:700, background:(CAT_COLOR[e.category]||'#6b7280')+'18', color:CAT_COLOR[e.category]||'#6b7280', border:`1px solid ${CAT_COLOR[e.category]||'#6b7280'}33`, borderRadius:20, padding:'2px 9px' }}>
                        {CAT_LABEL[e.category]||e.category}
                      </span>
                    </td>
                    <td style={{ padding:'0.6rem 0.8rem', whiteSpace:'nowrap', color:'var(--text-muted)' }}>
                      {new Date(e.expenseDate).toLocaleDateString('en-ET', { day:'numeric', month:'short', year:'numeric' })}
                    </td>
                    <td style={{ padding:'0.6rem 0.8rem', fontWeight:800, color: e.status==='paid' ? '#16a34a' : '#374151' }}>
                      {formatETB(e.amount)}
                    </td>
                    <td style={{ padding:'0.6rem 0.8rem', fontSize:'0.78rem', color:'var(--text-muted)' }}>
                      {e.createdByName||'—'}
                    </td>
                    <td style={{ padding:'0.6rem 0.8rem' }}>
                      <span style={{ fontSize:'0.72rem', fontWeight:700, background:sm.bg, color:sm.color, border:`1px solid ${sm.border}`, borderRadius:20, padding:'2px 10px' }}>
                        {sm.label}
                      </span>
                      {e.status === 'rejected' && e.rejectionReason && (
                        <div style={{ fontSize:'0.65rem', color:'#dc2626', marginTop:2 }}>{e.rejectionReason}</div>
                      )}
                    </td>
                    <td style={{ padding:'0.6rem 0.8rem', whiteSpace:'nowrap' }}>
                      <div style={{ display:'flex', gap:4 }}>
                        {/* Edit — only draft, only creator or owner */}
                        {canCreate && e.status === 'draft' && (
                          <button className="btn btn-outline btn-sm" onClick={()=>openEdit(e)} title={t('edit')}>
                            <i className="fi fi-rr-edit" />
                          </button>
                        )}
                        {/* Submit — office manager submits for approval */}
                        {canSubmit && e.status === 'draft' && (
                          <button className="btn btn-sm"
                            style={{ background:'#eff6ff', color:'#1e40af', border:'1px solid #bfdbfe', borderRadius:6, padding:'3px 10px', fontSize:'0.75rem', cursor:'pointer' }}
                            onClick={()=>act(expenseApi.submit, e._id||e.id)} title="Submit for approval">
                            {t('submit')}
                          </button>
                        )}
                        {/* Approve — owner/admin */}
                        {canApprove && e.status === 'submitted' && (
                          <button className="btn btn-sm"
                            style={{ background:'#dcfce7', color:'#166534', border:'1px solid #bbf7d0', borderRadius:6, padding:'3px 10px', fontSize:'0.75rem', cursor:'pointer' }}
                            onClick={()=>act(expenseApi.approve, e._id||e.id)} title="Approve">
                            {t('approveExpense')}
                          </button>
                        )}
                        {/* Reject */}
                        {canApprove && e.status === 'submitted' && (
                          <button className="btn btn-sm"
                            style={{ background:'#fee2e2', color:'#991b1b', border:'1px solid #fecaca', borderRadius:6, padding:'3px 10px', fontSize:'0.75rem', cursor:'pointer' }}
                            onClick={()=>{ setRejectId(e._id||e.id); setRejectReason(''); }} title="Reject">
                            {t('rejectExpense')}
                          </button>
                        )}
                        {/* Pay */}
                        {canPay && e.status === 'approved' && (
                          <button className="btn btn-sm"
                            style={{ background:'#f0fdf4', color:'#166534', border:'1px solid #86efac', borderRadius:6, padding:'3px 10px', fontSize:'0.75rem', cursor:'pointer' }}
                            onClick={()=>act(expenseApi.pay, e._id||e.id, '')} title="Mark as paid">
                            {t('payExpense')}
                          </button>
                        )}
                        {/* Delete — owner only, draft/rejected */}
                        {canDelete && ['draft','rejected'].includes(e.status) && (
                          <button className="btn btn-sm"
                            style={{ background:'#fee2e2', color:'#991b1b', border:'1px solid #fecaca', borderRadius:6, padding:'3px 8px', cursor:'pointer' }}
                            onClick={()=>handleDelete(e._id||e.id)} title={t('delete')}>
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
      )}

      {/* Pagination */}
      {summary?.total > 20 && (
        <div style={{ display:'flex', justifyContent:'center', gap:'0.5rem', marginTop:'1rem' }}>
          <button className="btn btn-outline btn-sm" disabled={page===1} onClick={()=>setPage(p=>p-1)}>← Prev</button>
          <span style={{ padding:'0.4rem 0.8rem', fontSize:'0.85rem', color:'var(--text-muted)' }}>
            Page {page}
          </span>
          <button className="btn btn-outline btn-sm" disabled={expenses.length<20} onClick={()=>setPage(p=>p+1)}>Next →</button>
        </div>
      )}

      {/* ── Reject modal ── */}
      {rejectId && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}>
          <div style={{ background:'#fff', borderRadius:14, padding:'1.5rem', width:'100%', maxWidth:420, boxShadow:'0 8px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginBottom:'0.8rem', fontWeight:700, color:'#991b1b' }}>
              <i className="fi fi-rr-cross-circle" style={{ marginRight:8 }} />Reject Expense
            </h3>
            <div className="form-group">
              <label>Reason *</label>
              <textarea rows={3} value={rejectReason} onChange={e=>setRejectReason(e.target.value)}
                placeholder="Reason for rejection…"
                style={{ width:'100%', padding:'0.5rem', borderRadius:6, border:'1px solid var(--border)', fontSize:'0.88rem', resize:'vertical' }} />
            </div>
            <div style={{ display:'flex', gap:'0.5rem', justifyContent:'flex-end', marginTop:'0.8rem' }}>
              <button className="btn btn-outline" onClick={()=>setRejectId(null)}>{t('cancel')}</button>
              <button disabled={!rejectReason.trim()}
                style={{ background:'#dc2626', color:'#fff', border:'none', borderRadius:8, padding:'0.5rem 1.2rem', fontWeight:700, cursor: rejectReason.trim() ? 'pointer' : 'not-allowed', opacity: rejectReason.trim() ? 1 : 0.6 }}
                onClick={async()=>{ await act(expenseApi.reject, rejectId, rejectReason); setRejectId(null); }}>
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create / Edit modal ── */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'flex-start', justifyContent:'center', overflowY:'auto', padding:'1rem' }}>
          <div style={{ background:'#fff', borderRadius:14, padding:'1.5rem', width:'100%', maxWidth:580, marginTop:'2rem', boxShadow:'0 8px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontWeight:700, marginBottom:'1rem' }}>
              <i className="fi fi-rr-receipt" style={{ marginRight:8, color:'#ef4444' }} />
              {editing ? 'Edit Expense' : t('addExpense')}
            </h3>
            {error && <div className="alert alert-error" style={{ marginBottom:'0.8rem' }}>{error}</div>}

            {/* Budget info for selected category */}
            {activeBudget && (() => {
              const bc = getBudgetCat(form.category);
              if (!bc || !bc.allocated) return null;
              const pct  = Math.round((bc.used / bc.allocated) * 100);
              const rem  = bc.allocated - bc.used;
              const amt  = parseFloat(form.amount) || 0;
              const after = bc.used + amt;
              const afterPct = Math.round((after / bc.allocated) * 100);
              return (
                <div style={{ background: afterPct > 100 ? '#fef2f2' : '#f0fdf4', border:`1px solid ${afterPct > 100 ? '#fca5a5' : '#86efac'}`, borderRadius:8, padding:'0.6rem 0.9rem', marginBottom:'0.9rem', fontSize:'0.78rem' }}>
                  <div style={{ fontWeight:700, color: afterPct > 100 ? '#dc2626' : '#166534', marginBottom:3 }}>
                    <i className="fi fi-rr-coin" style={{ marginRight:5 }} />
                    {CAT_LABEL[form.category]} Budget: {formatETB(bc.allocated)}
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', color:'#374151' }}>
                    <span>Used: {formatETB(bc.used)} ({pct}%)</span>
                    <span style={{ color: rem >= 0 ? '#16a34a' : '#dc2626' }}>
                      {rem >= 0 ? `${formatETB(rem)} remaining` : `${formatETB(Math.abs(rem))} over budget`}
                    </span>
                  </div>
                  {amt > 0 && (
                    <div style={{ marginTop:4, color: afterPct > 100 ? '#dc2626' : '#374151' }}>
                      After this expense: <strong>{formatETB(after)}</strong> used ({afterPct}%)
                      {afterPct > 100 && ' ⚠ Exceeds budget'}
                    </div>
                  )}
                  <div style={{ height:5, background:'#e5e7eb', borderRadius:3, marginTop:5, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${Math.min(100,afterPct)}%`, background: afterPct > 100 ? '#ef4444' : '#16a34a', borderRadius:3 }} />
                  </div>
                </div>
              );
            })()}

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.7rem' }}>
              <div className="form-group" style={{ gridColumn:'1/-1' }}>
                <label>{t('expenseTitle')} *</label>
                <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Diesel fuel for irrigation pump" />
              </div>
              <div className="form-group">
                <label>{t('expenseCategory')} *</label>
                <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
                  {CATEGORIES.map(c=><option key={c} value={c}>{CAT_LABEL[c]}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>{t('expenseAmount')} *</label>
                <input type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="0.00" min="0.01" step="0.01" />
              </div>
              <div className="form-group">
                <label>{t('expenseDate')} *</label>
                <input type="date" value={form.expenseDate} onChange={e=>setForm(f=>({...f,expenseDate:e.target.value}))} />
              </div>
              <div className="form-group">
                <label>{t('vendor')}</label>
                <input value={form.vendor} onChange={e=>setForm(f=>({...f,vendor:e.target.value}))} placeholder="Supplier name" />
              </div>
              <div className="form-group">
                <label>{t('invoiceNo')}</label>
                <input value={form.invoiceNo} onChange={e=>setForm(f=>({...f,invoiceNo:e.target.value}))} placeholder="INV-0001" />
              </div>
              <div className="form-group">
                <label>{t('receiptRef')}</label>
                <input value={form.receiptRef} onChange={e=>setForm(f=>({...f,receiptRef:e.target.value}))} placeholder="RCP-0001" />
              </div>
              <div className="form-group" style={{ gridColumn:'1/-1' }}>
                <label>{t('notes')}</label>
                <textarea rows={2} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}
                  style={{ width:'100%', padding:'0.5rem', borderRadius:6, border:'1px solid var(--border)', resize:'vertical', fontSize:'0.88rem' }} />
              </div>
            </div>

            {/* Owner approval warning */}
            {parseFloat(form.amount) >= OWNER_THRESHOLD && (
              <div style={{ background:'#f5f3ff', border:'1px solid #c4b5fd', borderRadius:8, padding:'0.6rem 0.9rem', marginTop:'0.5rem', fontSize:'0.82rem', color:'#5b21b6' }}>
                <i className="fi fi-rr-info" style={{ marginRight:6 }} />
                This expense (≥ {formatETB(OWNER_THRESHOLD)}) requires <strong>Owner approval</strong>.
              </div>
            )}

            <div style={{ display:'flex', gap:'0.5rem', justifyContent:'flex-end', marginTop:'1rem' }}>
              <button className="btn btn-outline" onClick={()=>setShowForm(false)}>{t('cancel')}</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving
                  ? <><i className="fi fi-rr-spinner" style={{ marginRight:5 }} />Saving…</>
                  : <><i className="fi fi-rr-check" style={{ marginRight:5 }} />{editing ? t('saveChanges') : t('addExpense')}</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
