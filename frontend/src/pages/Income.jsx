import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { incomeApi, financialAuditApi, formatETB } from '../services/api';

const SOURCE_LABEL = { crop_sales:'Crop Sales', livestock:'Livestock', government_grant:'Government Grant', consulting:'Consulting', donation:'Donation', rent:'Rent', other:'Other' };
const SOURCE_COLOR = { crop_sales:'#22c55e', livestock:'#84cc16', government_grant:'#3b82f6', consulting:'#8b5cf6', donation:'#f59e0b', rent:'#f97316', other:'#6b7280' };
const STATUS_COLOR = { received:'#22c55e', pending:'#f59e0b', cancelled:'#ef4444' };

const emptyForm = { title:'', description:'', source:'crop_sales', amount:'', incomeDate: new Date().toISOString().split('T')[0], cropType:'', quantity:'', unit:'', customer:'', invoiceNo:'', receiptRef:'', paymentMethod:'cash', notes:'' };

export default function Income() {
  const { user } = useAuth();
  const { t }    = useLang();
  const canCreate = ['owner','admin'].includes(user?.role);

  const [records,  setRecords]  = useState([]);
  const [summary,  setSummary]  = useState(null);
  const [pl,       setPL]       = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterFrom,   setFilterFrom]   = useState('');
  const [filterTo,     setFilterTo]     = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState(null);
  const [form,     setForm]     = useState(emptyForm);
  const [saving,   setSaving]   = useState(false);
  const [page,     setPage]     = useState(1);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const params = { page, limit:20 };
      if (filterSource) params.source = filterSource;
      if (filterFrom)   params.from   = filterFrom;
      if (filterTo)     params.to     = filterTo;
      const [res, sum, plData] = await Promise.all([
        incomeApi.getAll(params),
        incomeApi.getSummary(filterFrom, filterTo),
        financialAuditApi.getPL(filterFrom, filterTo).catch(()=>null),
      ]);
      setRecords(res?.records || []); setSummary(sum); setPL(plData);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filterSource, filterFrom, filterTo, page]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowForm(true); };
  const openEdit   = (r) => {
    setEditing(r);
    setForm({ title:r.title, description:r.description||'', source:r.source, amount:r.amount, incomeDate: new Date(r.incomeDate).toISOString().split('T')[0], cropType:r.cropType||'', quantity:r.quantity||'', unit:r.unit||'', customer:r.customer||'', invoiceNo:r.invoiceNo||'', receiptRef:r.receiptRef||'', paymentMethod:r.paymentMethod||'cash', notes:r.notes||'' });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.amount || !form.incomeDate) { setError('Title, amount, and date are required.'); return; }
    setSaving(true); setError('');
    try {
      if (editing) await incomeApi.update(editing._id||editing.id, form);
      else          await incomeApi.create(form);
      setSuccess(editing ? 'Income record updated!' : 'Income recorded!');
      setShowForm(false); load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this income record?')) return;
    try { await incomeApi.remove(id); setSuccess('Record deleted.'); load(); }
    catch (e) { setError(e.message); }
  };

  return (
    <div>
      <div className="page-header">
        <h1><i className="fi fi-rr-arrow-trend-up" style={{ marginRight:8, color:'#22c55e' }} />{t('incomeManagement')}</h1>
        <div className="header-actions">
          {canCreate && <button className="btn btn-primary" onClick={openCreate}><i className="fi fi-rr-plus" style={{ marginRight:6 }} />{t('addIncome')}</button>}
          <select value={filterSource} onChange={e=>{setFilterSource(e.target.value);setPage(1);}} style={{ padding:'0.4rem 0.8rem', borderRadius:6, border:'1px solid var(--border)', fontSize:'0.85rem' }}>
            <option value="">{t('all')} {t('incomeSource')}</option>
            {Object.entries(SOURCE_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
          </select>
          <input type="date" value={filterFrom} onChange={e=>setFilterFrom(e.target.value)} style={{ padding:'0.4rem 0.6rem', borderRadius:6, border:'1px solid var(--border)', fontSize:'0.83rem' }} placeholder="From" />
          <input type="date" value={filterTo}   onChange={e=>setFilterTo(e.target.value)}   style={{ padding:'0.4rem 0.6rem', borderRadius:6, border:'1px solid var(--border)', fontSize:'0.83rem' }} placeholder="To" />
          <button className="btn btn-outline btn-sm" onClick={load}><i className="fi fi-rr-refresh" /></button>
        </div>
      </div>

      {error   && <div className="alert alert-error"   style={{ marginBottom:'0.6rem' }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom:'0.6rem' }}>{success}</div>}

      {/* Summary + P&L */}
      <div className="grid-2" style={{ marginBottom:'1rem' }}>
        {summary && (
          <div className="card">
            <div className="card-header"><span className="card-title"><i className="fi fi-rr-chart-pie" style={{ marginRight:6 }} />Income by Source</span></div>
            {Object.entries(summary.bySource||{}).length > 0 ? (
              <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
                {Object.entries(summary.bySource).map(([k,v])=>(
                  <div key={k} style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:10, height:10, borderRadius:'50%', background:SOURCE_COLOR[k]||'#6b7280', flexShrink:0 }} />
                    <span style={{ flex:1, fontSize:'0.83rem' }}>{SOURCE_LABEL[k]||k}</span>
                    <span style={{ fontWeight:700, fontSize:'0.85rem', color:SOURCE_COLOR[k]||'#6b7280' }}>{formatETB(v)}</span>
                  </div>
                ))}
                <div style={{ borderTop:'1px solid var(--border)', paddingTop:'0.4rem', display:'flex', justifyContent:'space-between', fontWeight:800, fontSize:'0.9rem' }}>
                  <span>Total Income</span><span style={{ color:'#16a34a' }}>{formatETB(summary.total)}</span>
                </div>
              </div>
            ) : <p style={{ color:'var(--text-muted)', fontSize:'0.85rem' }}>No income data.</p>}
          </div>
        )}
        {pl && (
          <div className="card" style={{ borderLeft:`4px solid ${pl.isProfit?'#22c55e':'#ef4444'}` }}>
            <div className="card-header">
              <span className="card-title"><i className={`fi ${pl.isProfit?'fi-rr-arrow-trend-up':'fi-rr-arrow-trend-down'}`} style={{ marginRight:6, color:pl.isProfit?'#22c55e':'#ef4444' }} />Profit & Loss</span>
              <span style={{ fontSize:'0.72rem', fontWeight:700, background:pl.isProfit?'#dcfce7':'#fee2e2', color:pl.isProfit?'#166534':'#991b1b', borderRadius:20, padding:'2px 10px' }}>{pl.isProfit?'Profit':'Loss'} {Math.abs(pl.margin||0)}%</span>
            </div>
            {[['Total Income',formatETB(pl.totalIncome),'#22c55e'],['Total Expenses',formatETB(pl.totalExpenses),'#ef4444'],['Payroll Costs',formatETB(pl.totalPayroll),'#f97316'],[pl.isProfit?'Net Profit':'Net Loss',formatETB(Math.abs(pl.profitLoss||0)),pl.isProfit?'#16a34a':'#dc2626']].map(([k,v,c])=>(
              <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'0.25rem 0', borderBottom:'1px solid var(--border)', fontSize:'0.85rem' }}>
                <span style={{ color:'var(--text-muted)' }}>{k}</span><span style={{ fontWeight:700, color:c }}>{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:'2rem', color:'var(--text-muted)' }}><i className="fi fi-rr-spinner" /> Loading income records…</div>
      ) : records.length===0 ? (
        <div className="card" style={{ textAlign:'center', padding:'2.5rem' }}>
          <i className="fi fi-rr-arrow-trend-up" style={{ fontSize:'2.5rem', color:'var(--text-muted)' }} />
          <p style={{ marginTop:'0.8rem', color:'var(--text-muted)' }}>No income records found.</p>
        </div>
      ) : (
        <div className="card" style={{ padding:0, overflow:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.84rem' }}>
            <thead>
              <tr style={{ background:'#f9fafb', borderBottom:'2px solid var(--border)' }}>
                {['Title','Source','Date','Amount','Customer','Status','Actions'].map(h=>(
                  <th key={h} style={{ padding:'0.6rem 0.8rem', textAlign:'left', fontWeight:700, color:'var(--text-muted)', fontSize:'0.75rem', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map(r=>(
                <tr key={r._id||r.id} style={{ borderBottom:'1px solid var(--border)' }} className="table-row-hover">
                  <td style={{ padding:'0.6rem 0.8rem', fontWeight:600 }}>{r.title}{r.cropType&&<span style={{ marginLeft:6, fontSize:'0.72rem', color:'var(--text-muted)' }}>{r.cropType}</span>}</td>
                  <td style={{ padding:'0.6rem 0.8rem' }}>
                    <span style={{ fontSize:'0.72rem', fontWeight:700, background:(SOURCE_COLOR[r.source]||'#6b7280')+'22', color:SOURCE_COLOR[r.source]||'#6b7280', border:`1px solid ${SOURCE_COLOR[r.source]||'#6b7280'}44`, borderRadius:20, padding:'2px 8px' }}>{SOURCE_LABEL[r.source]||r.source}</span>
                  </td>
                  <td style={{ padding:'0.6rem 0.8rem', whiteSpace:'nowrap' }}>{new Date(r.incomeDate).toLocaleDateString()}</td>
                  <td style={{ padding:'0.6rem 0.8rem', fontWeight:700, color:'#16a34a' }}>{formatETB(r.amount)}</td>
                  <td style={{ padding:'0.6rem 0.8rem', color:'var(--text-muted)' }}>{r.customer||'—'}</td>
                  <td style={{ padding:'0.6rem 0.8rem' }}>
                    <span style={{ fontSize:'0.72rem', fontWeight:700, background:(STATUS_COLOR[r.status]||'#6b7280')+'22', color:STATUS_COLOR[r.status]||'#6b7280', borderRadius:20, padding:'2px 8px', textTransform:'capitalize' }}>{r.status}</span>
                  </td>
                  <td style={{ padding:'0.6rem 0.8rem', whiteSpace:'nowrap', display:'flex', gap:4 }}>
                    {canCreate && <button className="btn btn-outline btn-sm" onClick={()=>openEdit(r)} title="Edit"><i className="fi fi-rr-edit" /></button>}
                    {user?.role==='owner' && <button className="btn btn-sm" style={{ background:'#fee2e2', color:'#991b1b', border:'1px solid #fecaca', borderRadius:6, padding:'3px 8px' }} onClick={()=>handleDelete(r._id||r.id)} title="Delete"><i className="fi fi-rr-trash" /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit modal */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'flex-start', justifyContent:'center', overflowY:'auto', padding:'1rem' }}>
          <div style={{ background:'#fff', borderRadius:14, padding:'1.5rem', width:'100%', maxWidth:560, marginTop:'2rem', boxShadow:'0 8px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontWeight:700, marginBottom:'1rem' }}><i className="fi fi-rr-arrow-trend-up" style={{ marginRight:8, color:'#22c55e' }} />{editing?'Edit Income':'Record Income'}</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.7rem' }}>
              <div className="form-group" style={{ gridColumn:'1/-1' }}><label>Title *</label><input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Teff crop sale — March" /></div>
              <div className="form-group"><label>Source *</label>
                <select value={form.source} onChange={e=>setForm(f=>({...f,source:e.target.value}))}>
                  {Object.entries(SOURCE_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Amount (ETB) *</label><input type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="0.00" min="0" step="0.01" /></div>
              <div className="form-group"><label>Income Date *</label><input type="date" value={form.incomeDate} onChange={e=>setForm(f=>({...f,incomeDate:e.target.value}))} /></div>
              <div className="form-group"><label>Customer / Buyer</label><input value={form.customer} onChange={e=>setForm(f=>({...f,customer:e.target.value}))} placeholder="Name or organization" /></div>
              {form.source==='crop_sales' && <>
                <div className="form-group"><label>Crop Type</label><input value={form.cropType} onChange={e=>setForm(f=>({...f,cropType:e.target.value}))} placeholder="e.g. Teff, Maize" /></div>
                <div className="form-group"><label>Quantity</label><input type="number" value={form.quantity} onChange={e=>setForm(f=>({...f,quantity:e.target.value}))} placeholder="0" min="0" /></div>
                <div className="form-group"><label>Unit</label><input value={form.unit} onChange={e=>setForm(f=>({...f,unit:e.target.value}))} placeholder="kg / quintal / bag" /></div>
              </>}
              <div className="form-group"><label>Invoice No.</label><input value={form.invoiceNo} onChange={e=>setForm(f=>({...f,invoiceNo:e.target.value}))} placeholder="INV-0001" /></div>
              <div className="form-group"><label>Payment Method</label>
                <select value={form.paymentMethod} onChange={e=>setForm(f=>({...f,paymentMethod:e.target.value}))}>
                  {['cash','bank_transfer','cheque','mobile_money','other'].map(m=><option key={m} value={m}>{m.replace('_',' ')}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn:'1/-1' }}><label>Notes</label><textarea rows={2} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} style={{ width:'100%', padding:'0.5rem', borderRadius:6, border:'1px solid var(--border)', resize:'vertical', fontSize:'0.88rem' }} /></div>
            </div>
            <div style={{ display:'flex', gap:'0.5rem', justifyContent:'flex-end', marginTop:'0.8rem' }}>
              <button className="btn btn-outline" onClick={()=>setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?<i className="fi fi-rr-spinner" />:(editing?'Save Changes':'Record Income')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
