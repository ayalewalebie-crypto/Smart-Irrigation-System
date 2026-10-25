import { useNavigate, useSearchParams } from 'react-router-dom';

export default function PaymentCancel() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const txRef    = params.get('tx_ref') || '';

  return (
    <div style={{ minHeight:'100vh', background:'#f9fafb', display:'flex', alignItems:'center', justifyContent:'center', padding:'2rem' }}>
      <div style={{ background:'#fff', borderRadius:16, padding:'2.5rem 2rem', maxWidth:420, width:'100%', boxShadow:'0 8px 40px rgba(0,0,0,0.12)', textAlign:'center' }}>
        <div style={{ width:72, height:72, borderRadius:'50%', background:'#fff7ed', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1.2rem' }}>
          <i className="fi fi-rr-ban" style={{ fontSize:'2rem', color:'#f97316' }} />
        </div>
        <h2 style={{ fontWeight:800, color:'#92400e', marginBottom:8 }}>Payment Cancelled</h2>
        <p style={{ color:'#6b7280', fontSize:'0.88rem', marginBottom:'1.5rem' }}>
          The payment was cancelled. No money was transferred. The payroll record remains in <strong>Approved</strong> status — you can try paying again.
        </p>
        {txRef && (
          <div style={{ background:'#f9fafb', borderRadius:8, padding:'0.5rem 0.8rem', marginBottom:'1.2rem', fontSize:'0.75rem', color:'#9ca3af', fontFamily:'monospace' }}>
            Ref: {txRef}
          </div>
        )}
        <div style={{ display:'flex', gap:'0.75rem', justifyContent:'center' }}>
          <button onClick={() => navigate('/payroll')}
            style={{ background:'#166534', color:'#fff', border:'none', borderRadius:8, padding:'0.65rem 1.5rem', fontWeight:700, cursor:'pointer', fontSize:'0.9rem' }}>
            <i className="fi fi-rr-money-check-edit" style={{ marginRight:6 }} />Back to Payroll
          </button>
        </div>
      </div>
    </div>
  );
}
