import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { payrollApi, formatETB } from '../services/api';

export default function PaymentSuccess() {
  const [params]  = useSearchParams();
  const navigate  = useNavigate();
  const txRef     = params.get('tx_ref')    || '';
  const payrollId = params.get('payrollId') || '';

  const [status, setStatus] = useState('verifying'); // verifying | success | failed
  const [data,   setData]   = useState(null);
  const [error,  setError]  = useState('');

  useEffect(() => {
    if (!txRef) {
      setStatus('failed');
      setError('No transaction reference found.');
      return;
    }

    // Chapa may return a status param on failure/cancel
    const chapaStatus = params.get('status');
    if (chapaStatus && chapaStatus !== 'success') {
      setStatus('failed');
      setError(`Payment was ${chapaStatus}. You can try again from the Payroll page.`);
      return;
    }

    payrollApi.verifyPayment(txRef)
      .then(result => { setData(result); setStatus('success'); })
      .catch(err   => { setError(err.message); setStatus('failed'); });
  }, [txRef]);

  return (
    <div style={{ minHeight:'100vh', background:'#f9fafb', display:'flex', alignItems:'center', justifyContent:'center', padding:'2rem' }}>
      <div style={{ background:'#fff', borderRadius:16, padding:'2.5rem 2rem', maxWidth:480, width:'100%', boxShadow:'0 8px 40px rgba(0,0,0,0.12)', textAlign:'center' }}>

        {/* ── Verifying ── */}
        {status === 'verifying' && (
          <>
            <div style={{ width:72, height:72, borderRadius:'50%', background:'#eff6ff', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1.2rem' }}>
              <i className="fi fi-rr-spinner" style={{ fontSize:'2rem', color:'#3b82f6' }} />
            </div>
            <h2 style={{ fontWeight:800, color:'#374151', marginBottom:8 }}>Verifying Payment…</h2>
            <p style={{ color:'#6b7280', fontSize:'0.88rem' }}>Confirming your payment with Chapa, please wait.</p>
          </>
        )}

        {/* ── Success ── */}
        {status === 'success' && (
          <>
            <div style={{ width:72, height:72, borderRadius:'50%', background:'#dcfce7', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1.2rem' }}>
              <i className="fi fi-rr-check-circle" style={{ fontSize:'2rem', color:'#16a34a' }} />
            </div>
            <h2 style={{ fontWeight:800, color:'#166534', marginBottom:8 }}>
              {data?.alreadyPaid ? 'Already Paid' : 'Payment Successful!'}
            </h2>
            {data?.netSalary > 0 && (
              <div style={{ background:'#f0fdf4', border:'1px solid #86efac', borderRadius:10, padding:'1rem', marginBottom:'1.2rem' }}>
                <div style={{ fontSize:'0.72rem', color:'#6b7280', marginBottom:4 }}>Amount Paid</div>
                <div style={{ fontSize:'2rem', fontWeight:800, color:'#16a34a' }}>{formatETB(data.netSalary)}</div>
                <div style={{ fontSize:'0.75rem', color:'#6b7280', marginTop:4, fontFamily:'monospace' }}>
                  Ref: {data.txRef || txRef}
                </div>
              </div>
            )}
            <div style={{ display:'flex', gap:'0.75rem', justifyContent:'center' }}>
              <button onClick={() => navigate('/payroll')}
                style={{ background:'#166534', color:'#fff', border:'none', borderRadius:8, padding:'0.65rem 1.5rem', fontWeight:700, cursor:'pointer', fontSize:'0.9rem' }}>
                <i className="fi fi-rr-money-check-edit" style={{ marginRight:6 }} />Back to Payroll
              </button>
              <button onClick={() => navigate('/home')}
                style={{ background:'#f3f4f6', color:'#374151', border:'1px solid #d1d5db', borderRadius:8, padding:'0.65rem 1.2rem', fontWeight:600, cursor:'pointer', fontSize:'0.9rem' }}>
                Dashboard
              </button>
            </div>
          </>
        )}

        {/* ── Failed ── */}
        {status === 'failed' && (
          <>
            <div style={{ width:72, height:72, borderRadius:'50%', background:'#fee2e2', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1.2rem' }}>
              <i className="fi fi-rr-cross-circle" style={{ fontSize:'2rem', color:'#dc2626' }} />
            </div>
            <h2 style={{ fontWeight:800, color:'#991b1b', marginBottom:8 }}>Payment Failed</h2>
            <div style={{ background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:8, padding:'0.75rem 1rem', marginBottom:'1.2rem', fontSize:'0.84rem', color:'#7f1d1d' }}>
              <i className="fi fi-rr-triangle-warning" style={{ marginRight:6 }} />
              {error || 'Payment could not be verified.'}
            </div>
            <button onClick={() => navigate('/payroll')}
              style={{ background:'#dc2626', color:'#fff', border:'none', borderRadius:8, padding:'0.65rem 1.5rem', fontWeight:700, cursor:'pointer', fontSize:'0.9rem' }}>
              <i className="fi fi-rr-undo" style={{ marginRight:6 }} />Back to Payroll
            </button>
          </>
        )}

      </div>
    </div>
  );
}
