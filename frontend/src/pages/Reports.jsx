import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { reportApi, financialAuditApi, payrollApi, expenseApi, incomeApi, attendanceApi, formatETB } from '../services/api';

const REPORT_TYPES = [
  { key:'water',      label:'Water Usage',         icon:'fi-rr-shower',           roles:['owner','admin','office_manager'] },
  { key:'sensor',     label:'Sensor Logs',          icon:'fi-rr-signal-alt',       roles:['owner','admin'] },
  { key:'financial',  label:'Financial / P&L',      icon:'fi-rr-chart-histogram',  roles:['owner','admin'] },
  { key:'expense',    label:'Expense Report',        icon:'fi-rr-receipt',          roles:['owner','admin','office_manager'] },
  { key:'income',     label:'Income Report',         icon:'fi-rr-arrow-trend-up',   roles:['owner','admin'] },
  { key:'payroll',    label:'Payroll Report',        icon:'fi-rr-money-check-edit', roles:['owner','admin','office_manager'] },
  { key:'attendance', label:'Attendance Report',     icon:'fi-rr-user-time',        roles:['owner','admin','office_manager'] },
];

function exportCSV(rows, filename) {
  if (!rows?.length) return;
  const keys = Object.keys(rows[0]);
  const csv  = [keys.join(','), ...rows.map(r => keys.map(k => `"${String(r[k]??'').replace(/"/g,'""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type:'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href=url; a.download=filename; a.click();
  URL.revokeObjectURL(url);
}

function exportJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href=url; a.download=filename; a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const { user } = useAuth();
  const { t }    = useLang();
  const role     = user?.role;

  const availableTypes = REPORT_TYPES.filter(r => r.roles.includes(role));
  const [activeType, setActiveType] = useState(availableTypes[0]?.key || 'water');
  const [fromDate,   setFromDate]   = useState(() => { const d = new Date(); d.setMonth(d.getMonth()-1); return d.toISOString().split('T')[0]; });
  const [toDate,     setToDate]     = useState(new Date().toISOString().split('T')[0]);
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  const generate = async () => {
    setLoading(true); setError(''); setData(null);
    try {
      let result;
      if (activeType==='water')      result = await reportApi.getWaterUsage(fromDate, toDate);
      else if (activeType==='sensor')result = await reportApi.getSensorLogs(fromDate, toDate);
      else if (activeType==='financial') result = await financialAuditApi.getPL(fromDate, toDate);
      else if (activeType==='expense')   result = await expenseApi.getAll({ from:fromDate, to:toDate, limit:500 });
      else if (activeType==='income')    result = await incomeApi.getAll({ from:fromDate, to:toDate, limit:500 });
      else if (activeType==='payroll')   result = await payrollApi.getAll({ limit:500 });
      else if (activeType==='attendance')result = await attendanceApi.getAll({ from:fromDate, to:toDate, limit:500 });
      setData(result);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { generate(); }, [activeType]);

  const handleExportCSV = () => {
    let rows = [];
    if (activeType==='expense')    rows = (data?.expenses||[]).map(e=>({ title:e.title, category:e.category, amount:e.amount, date: new Date(e.expenseDate).toLocaleDateString(), status:e.status, vendor:e.vendor||'' }));
    else if (activeType==='income')rows = (data?.records||[]).map(r=>({ title:r.title, source:r.source, amount:r.amount, date: new Date(r.incomeDate).toLocaleDateString(), status:r.status, customer:r.customer||'' }));
    else if (activeType==='payroll')rows=(data?.records||[]).map(r=>({ employee:r.employeeName, period:r.payPeriod, gross:r.grossSalary, tax:r.incomeTax, pension:r.pensionEmployee, net:r.netSalary, status:r.status }));
    else if (activeType==='attendance')rows=(data?.records||[]).map(r=>({ employee:r.employeeName, date:r.date, status:r.status, checkIn:r.checkIn||'', checkOut:r.checkOut||'', workHours:r.workHours||0, overtime:r.overtimeHours||0 }));
    else if (activeType==='water') rows = Array.isArray(data) ? data : [];
    else if (activeType==='sensor')rows = Array.isArray(data) ? data : [];
    if (rows.length) exportCSV(rows, `${activeType}-report-${fromDate}-${toDate}.csv`);
    else alert('No data to export.');
  };

  const handleExportJSON = () => {
    if (data) exportJSON(data, `${activeType}-report-${fromDate}-${toDate}.json`);
  };

  const renderContent = () => {
    if (loading) return <div style={{ textAlign:'center', padding:'3rem', color:'var(--text-muted)' }}><i className="fi fi-rr-spinner" style={{ fontSize:'2rem' }} /><p style={{ marginTop:'0.5rem' }}>Generating report…</p></div>;
    if (error)   return <div className="alert alert-error">{error}</div>;
    if (!data)   return null;

    if (activeType==='financial' && data) return <FinancialReport data={data} />;
    if (activeType==='expense'   && data) return <ExpenseReport   rows={data?.expenses||[]} />;
    if (activeType==='income'    && data) return <IncomeReport    rows={data?.records||[]} />;
    if (activeType==='payroll'   && data) return <PayrollReport   rows={data?.records||[]} />;
    if (activeType==='attendance'&& data) return <AttendanceReport rows={data?.records||[]} />;
    if (activeType==='water'     && data) return <WaterReport     data={data} />;
    if (activeType==='sensor'    && data) return <SensorReport    data={data} />;
    return <div className="card" style={{ textAlign:'center', padding:'2rem', color:'var(--text-muted)' }}>No data for this period.</div>;
  };

  return (
    <div>
      <div className="page-header">
        <h1><i className="fi fi-rr-chart-histogram" style={{ marginRight:8, color:'#7c3aed' }} />{t('reportsTitle')}</h1>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={handleExportCSV}><i className="fi fi-rr-file-spreadsheet" style={{ marginRight:6 }} />Export CSV</button>
          <button className="btn btn-outline" onClick={handleExportJSON}><i className="fi fi-rr-file-download" style={{ marginRight:6 }} />Export JSON</button>
        </div>
      </div>

      {/* Controls */}
      <div className="card" style={{ marginBottom:'1rem' }}>
        <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap', alignItems:'center' }}>
          <div style={{ display:'flex', gap:'0.4rem', flexWrap:'wrap', flex:1 }}>
            {availableTypes.map(rt=>(
              <button key={rt.key} onClick={()=>setActiveType(rt.key)}
                className={`btn ${activeType===rt.key?'btn-primary':'btn-outline'} btn-sm`}
                style={{ fontSize:'0.8rem' }}>
                <i className={`fi ${rt.icon}`} style={{ marginRight:5 }} />{rt.label}
              </button>
            ))}
          </div>
          <div style={{ display:'flex', gap:'0.4rem', alignItems:'center' }}>
            <label style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>From</label>
            <input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)} style={{ padding:'0.35rem 0.5rem', borderRadius:6, border:'1px solid var(--border)', fontSize:'0.83rem' }} />
            <label style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>To</label>
            <input type="date" value={toDate} onChange={e=>setToDate(e.target.value)} style={{ padding:'0.35rem 0.5rem', borderRadius:6, border:'1px solid var(--border)', fontSize:'0.83rem' }} />
            <button className="btn btn-primary btn-sm" onClick={generate}><i className="fi fi-rr-chart-histogram" style={{ marginRight:5 }} />Generate</button>
          </div>
        </div>
      </div>

      {renderContent()}
    </div>
  );
}

// ── Report sub-components ──────────────────────────────────────────────────────

function FinancialReport({ data }) {
  return (
    <div>
      <div className="grid-2" style={{ marginBottom:'1rem' }}>
        <div className="card" style={{ borderLeft:`4px solid ${data.isProfit?'#22c55e':'#ef4444'}` }}>
          <div className="card-header"><span className="card-title">Profit & Loss Summary</span></div>
          {[['Total Income',formatETB(data.totalIncome),'#22c55e'],['Total Expenses',formatETB(data.totalExpenses),'#ef4444'],['Payroll Costs',formatETB(data.totalPayroll),'#f97316'],['Total Costs',formatETB(data.totalCosts),'#dc2626'],[data.isProfit?'Net Profit':'Net Loss',formatETB(Math.abs(data.profitLoss||0)),data.isProfit?'#16a34a':'#dc2626']].map(([k,v,c])=>(
            <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'0.3rem 0', borderBottom:'1px solid var(--border)', fontSize:'0.9rem' }}>
              <span style={{ color:'var(--text-muted)' }}>{k}</span><span style={{ fontWeight:700, color:c }}>{v}</span>
            </div>
          ))}
          <div style={{ marginTop:'0.6rem', padding:'0.5rem', background:data.isProfit?'#f0fdf4':'#fef2f2', borderRadius:8, textAlign:'center', fontWeight:800, color:data.isProfit?'#16a34a':'#dc2626' }}>
            {data.isProfit?'▲ PROFIT':'▼ LOSS'} · {Math.abs(data.margin||0)}% margin
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Income by Source</span></div>
          {Object.entries(data.bySource||{}).map(([k,v])=>(
            <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'0.25rem 0', borderBottom:'1px solid var(--border)', fontSize:'0.85rem' }}>
              <span style={{ textTransform:'capitalize' }}>{k.replace('_',' ')}</span><span style={{ fontWeight:600, color:'#22c55e' }}>{formatETB(v)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="card-header"><span className="card-title">Expenses by Category</span></div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:'0.5rem' }}>
          {Object.entries(data.byCategory||{}).map(([k,v])=>(
            <div key={k} style={{ padding:'0.5rem', background:'#fef2f2', borderRadius:8, border:'1px solid #fecaca' }}>
              <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', textTransform:'capitalize' }}>{k.replace('_',' ')}</div>
              <div style={{ fontWeight:700, color:'#ef4444' }}>{formatETB(v)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ExpenseReport({ rows }) {
  const total = rows.reduce((s,r)=>s+(r.amount||0),0);
  return (
    <div className="card" style={{ padding:0, overflow:'auto' }}>
      <div style={{ padding:'0.6rem 1rem', display:'flex', justifyContent:'space-between', borderBottom:'1px solid var(--border)' }}>
        <strong>{rows.length} expenses</strong><strong style={{ color:'#ef4444' }}>Total: {formatETB(total)}</strong>
      </div>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.84rem' }}>
        <thead><tr style={{ background:'#f9fafb' }}>{['Title','Category','Date','Amount','Status','Created By'].map(h=><th key={h} style={{ padding:'0.5rem 0.8rem', textAlign:'left', fontWeight:700, color:'var(--text-muted)', fontSize:'0.75rem' }}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r,i)=><tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
          <td style={{ padding:'0.5rem 0.8rem', fontWeight:600 }}>{r.title}</td>
          <td style={{ padding:'0.5rem 0.8rem', textTransform:'capitalize' }}>{r.category}</td>
          <td style={{ padding:'0.5rem 0.8rem' }}>{new Date(r.expenseDate).toLocaleDateString()}</td>
          <td style={{ padding:'0.5rem 0.8rem', fontWeight:700 }}>{formatETB(r.amount)}</td>
          <td style={{ padding:'0.5rem 0.8rem', textTransform:'capitalize' }}>{r.status}</td>
          <td style={{ padding:'0.5rem 0.8rem', color:'var(--text-muted)' }}>{r.createdByName||'—'}</td>
        </tr>)}</tbody>
      </table>
    </div>
  );
}

function IncomeReport({ rows }) {
  const total = rows.reduce((s,r)=>s+(r.amount||0),0);
  return (
    <div className="card" style={{ padding:0, overflow:'auto' }}>
      <div style={{ padding:'0.6rem 1rem', display:'flex', justifyContent:'space-between', borderBottom:'1px solid var(--border)' }}>
        <strong>{rows.length} records</strong><strong style={{ color:'#16a34a' }}>Total: {formatETB(total)}</strong>
      </div>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.84rem' }}>
        <thead><tr style={{ background:'#f9fafb' }}>{['Title','Source','Date','Amount','Customer'].map(h=><th key={h} style={{ padding:'0.5rem 0.8rem', textAlign:'left', fontWeight:700, color:'var(--text-muted)', fontSize:'0.75rem' }}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r,i)=><tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
          <td style={{ padding:'0.5rem 0.8rem', fontWeight:600 }}>{r.title}</td>
          <td style={{ padding:'0.5rem 0.8rem', textTransform:'capitalize' }}>{r.source?.replace('_',' ')}</td>
          <td style={{ padding:'0.5rem 0.8rem' }}>{new Date(r.incomeDate).toLocaleDateString()}</td>
          <td style={{ padding:'0.5rem 0.8rem', fontWeight:700, color:'#16a34a' }}>{formatETB(r.amount)}</td>
          <td style={{ padding:'0.5rem 0.8rem', color:'var(--text-muted)' }}>{r.customer||'—'}</td>
        </tr>)}</tbody>
      </table>
    </div>
  );
}

function PayrollReport({ rows }) {
  const totalNet = rows.reduce((s,r)=>s+(r.netSalary||0),0);
  return (
    <div className="card" style={{ padding:0, overflow:'auto' }}>
      <div style={{ padding:'0.6rem 1rem', display:'flex', justifyContent:'space-between', borderBottom:'1px solid var(--border)' }}>
        <strong>{rows.length} payroll records</strong><strong style={{ color:'#0891b2' }}>Total Net: {formatETB(totalNet)}</strong>
      </div>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.84rem' }}>
        <thead><tr style={{ background:'#f9fafb' }}>{['Employee','Period','Gross','Tax','Pension','Net Pay','Status'].map(h=><th key={h} style={{ padding:'0.5rem 0.8rem', textAlign:'left', fontWeight:700, color:'var(--text-muted)', fontSize:'0.75rem' }}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r,i)=><tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
          <td style={{ padding:'0.5rem 0.8rem', fontWeight:600 }}>{r.employeeName}</td>
          <td style={{ padding:'0.5rem 0.8rem' }}>{r.payPeriod}</td>
          <td style={{ padding:'0.5rem 0.8rem' }}>{formatETB(r.grossSalary)}</td>
          <td style={{ padding:'0.5rem 0.8rem', color:'#ef4444' }}>{formatETB(r.incomeTax)}</td>
          <td style={{ padding:'0.5rem 0.8rem', color:'#f97316' }}>{formatETB(r.pensionEmployee)}</td>
          <td style={{ padding:'0.5rem 0.8rem', fontWeight:700, color:'#16a34a' }}>{formatETB(r.netSalary)}</td>
          <td style={{ padding:'0.5rem 0.8rem', textTransform:'capitalize' }}>{r.status}</td>
        </tr>)}</tbody>
      </table>
    </div>
  );
}

function AttendanceReport({ rows }) {
  const presentCount = rows.filter(r=>['present','late','half_day','overtime'].includes(r.status)).length;
  const absentCount  = rows.filter(r=>r.status==='absent').length;
  return (
    <div className="card" style={{ padding:0, overflow:'auto' }}>
      <div style={{ padding:'0.6rem 1rem', display:'flex', gap:'1rem', borderBottom:'1px solid var(--border)', flexWrap:'wrap' }}>
        <strong>{rows.length} records</strong>
        <span style={{ color:'#22c55e' }}>Present: {presentCount}</span>
        <span style={{ color:'#ef4444' }}>Absent: {absentCount}</span>
      </div>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.84rem' }}>
        <thead><tr style={{ background:'#f9fafb' }}>{['Employee','Date','Status','Check In','Check Out','Work Hrs','OT Hrs'].map(h=><th key={h} style={{ padding:'0.5rem 0.8rem', textAlign:'left', fontWeight:700, color:'var(--text-muted)', fontSize:'0.75rem' }}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r,i)=><tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
          <td style={{ padding:'0.5rem 0.8rem', fontWeight:600 }}>{r.employeeName}</td>
          <td style={{ padding:'0.5rem 0.8rem' }}>{r.date}</td>
          <td style={{ padding:'0.5rem 0.8rem', textTransform:'capitalize' }}>{r.status}</td>
          <td style={{ padding:'0.5rem 0.8rem' }}>{r.checkIn||'—'}</td>
          <td style={{ padding:'0.5rem 0.8rem' }}>{r.checkOut||'—'}</td>
          <td style={{ padding:'0.5rem 0.8rem' }}>{r.workHours||0}h</td>
          <td style={{ padding:'0.5rem 0.8rem', color: r.overtimeHours>0?'#3b82f6':'var(--text-muted)' }}>{r.overtimeHours||0}h</td>
        </tr>)}</tbody>
      </table>
    </div>
  );
}

function WaterReport({ data }) {
  const rows = Array.isArray(data) ? data : (data?.data || []);
  const total = rows.reduce((s,r)=>s+(r.waterLiters||r.value||0),0);
  return (
    <div className="card" style={{ padding:0, overflow:'auto' }}>
      <div style={{ padding:'0.6rem 1rem', borderBottom:'1px solid var(--border)' }}>
        <strong>Total Water Used: {total.toFixed(1)} L</strong>
      </div>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.84rem' }}>
        <thead><tr style={{ background:'#f9fafb' }}>{['Date','Water (L)','Avg Moisture (%)','Irrigation Events'].map(h=><th key={h} style={{ padding:'0.5rem 0.8rem', textAlign:'left', fontWeight:700, color:'var(--text-muted)', fontSize:'0.75rem' }}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r,i)=><tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
          <td style={{ padding:'0.5rem 0.8rem' }}>{r.date||r.label}</td>
          <td style={{ padding:'0.5rem 0.8rem', fontWeight:600, color:'#3b82f6' }}>{r.waterLiters||r.value||0}</td>
          <td style={{ padding:'0.5rem 0.8rem' }}>{r.avgMoisture||'—'}</td>
          <td style={{ padding:'0.5rem 0.8rem' }}>{r.events||'—'}</td>
        </tr>)}</tbody>
      </table>
    </div>
  );
}

function SensorReport({ data }) {
  const rows = Array.isArray(data) ? data : [];
  return (
    <div className="card" style={{ padding:0, overflow:'auto' }}>
      <div style={{ padding:'0.6rem 1rem', borderBottom:'1px solid var(--border)' }}>
        <strong>{rows.length} sensor log entries</strong>
      </div>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.84rem' }}>
        <thead><tr style={{ background:'#f9fafb' }}>{['Device','Zone','Temp','Humidity','Moisture','pH','Water Lvl','Time'].map(h=><th key={h} style={{ padding:'0.5rem 0.8rem', textAlign:'left', fontWeight:700, color:'var(--text-muted)', fontSize:'0.75rem' }}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r,i)=><tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
          <td style={{ padding:'0.5rem 0.8rem', fontWeight:600 }}>{r.deviceId}</td>
          <td style={{ padding:'0.5rem 0.8rem' }}>{r.zoneName||'—'}</td>
          <td style={{ padding:'0.5rem 0.8rem' }}>{r.temp||0}°C</td>
          <td style={{ padding:'0.5rem 0.8rem' }}>{r.humidity||0}%</td>
          <td style={{ padding:'0.5rem 0.8rem' }}>{r.moisture||0}%</td>
          <td style={{ padding:'0.5rem 0.8rem' }}>{r.ph||0}</td>
          <td style={{ padding:'0.5rem 0.8rem' }}>{r.waterLevel||0}%</td>
          <td style={{ padding:'0.5rem 0.8rem', color:'var(--text-muted)', whiteSpace:'nowrap' }}>{new Date(r.recordedAt).toLocaleString()}</td>
        </tr>)}</tbody>
      </table>
    </div>
  );
}
