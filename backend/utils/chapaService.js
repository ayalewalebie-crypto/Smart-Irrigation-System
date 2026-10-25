const { Chapa } = require('chapa-nodejs');

const chapa = new Chapa({
  secretKey: process.env.CHAPA_SECRET_KEY || '',
});

/**
 * Initialize a Chapa checkout — always redirects to Chapa payment page.
 * No simulation. Requires CHAPA_SECRET_KEY in backend/.env
 */
async function initializeCheckout({ employeeName, employeeEmail, phone, amount, txRef, payPeriod, callbackUrl, returnUrl }) {
  if (!amount || amount <= 0) throw new Error('Invalid payment amount.');

  const secretKey = process.env.CHAPA_SECRET_KEY || '';
  if (!secretKey || secretKey.includes('xxxxxxxx')) {
    throw new Error(
      'Chapa secret key not set. Add your test key to backend/.env:\n' +
      'CHAPA_SECRET_KEY=CHASECK_TEST-your-key-here'
    );
  }

  const nameParts = (employeeName || 'Employee').split(' ');
  const firstName = nameParts[0] || 'Employee';
  const lastName  = nameParts.slice(1).join(' ') || '.';
  const phone_number = (phone || '0911000000').replace(/\D/g, '').slice(-9).padStart(10, '0');

  const response = await chapa.initialize({
    first_name:    firstName,
    last_name:     lastName,
    email:         employeeEmail || `${txRef.toLowerCase()}@farm.com`,
    phone_number,
    currency:      'ETB',
    amount:        String(Number(amount).toFixed(2)),
    tx_ref:        txRef,
    callback_url:  callbackUrl,
    return_url:    returnUrl,
    customization: {
      title:       `Salary — ${payPeriod}`,
      description: `Net salary for ${employeeName} (${payPeriod})`,
    },
  });

  console.log(`[Chapa] raw response:`, JSON.stringify(response, null, 2));

  // Handle both response shapes from chapa-nodejs
  const checkoutUrl = response?.data?.checkout_url   // { status, data: { checkout_url } }
                   || response?.checkout_url          // { checkout_url } directly
                   || (typeof response?.data === 'string' ? response.data : null); // data is the URL

  if (response.status !== 'success' || !checkoutUrl) {
    throw new Error(`Chapa error: ${response.message || JSON.stringify(response)}`);
  }

  console.log(`[Chapa] checkout_url: ${checkoutUrl}`);

  return {
    checkoutUrl,
    txRef,
  };
}

/**
 * Verify a completed payment by tx_ref.
 */
async function verifyPayment(txRef) {
  const response = await chapa.verify({ tx_ref: txRef });
  return response;
}

/**
 * Direct bank transfer (used for non-checkout flow if needed).
 */
async function paySalary({ accountName, accountNumber, bankCode, amount, reference }) {
  if (!accountNumber) throw new Error('Bank account number is required.');
  if (!bankCode)      throw new Error('Bank code is required.');
  if (!amount || amount <= 0) throw new Error('Invalid payment amount.');

  const response = await chapa.transfer({
    account_name:   accountName,
    account_number: String(accountNumber),
    amount:         String(amount),
    currency:       'ETB',
    reference,
    bank_code:      Number(bankCode),
  });

  if (response.status !== 'success') {
    throw new Error(`Chapa transfer failed: ${response.message}`);
  }

  return {
    txRef:    reference,
    chapaRef: response.data || reference,
    message:  response.message,
  };
}

/**
 * Bulk salary transfer.
 */
async function payBulkSalary(title, employees) {
  if (!employees || employees.length === 0) throw new Error('No employees provided.');

  const bulk_data = employees.map(e => ({
    account_name:   e.accountName,
    account_number: String(e.accountNumber),
    amount:         e.amount,
    reference:      e.reference,
    bank_code:      Number(e.bankCode),
  }));

  const response = await chapa.bulkTransfer({ title, currency: 'ETB', bulk_data });

  if (response.status !== 'success') {
    throw new Error(`Chapa bulk transfer failed: ${response.message}`);
  }

  return {
    bulkId:    response.data?.id,
    createdAt: response.data?.created_at,
    message:   response.message,
  };
}

/**
 * Verify a transfer by tx_ref.
 */
async function verifyTransfer(txRef) {
  return await chapa.verifyTransfer({ tx_ref: txRef });
}

/**
 * Get supported banks — with static Ethiopian fallback.
 */
const ETHIOPIAN_BANKS = [
  { id: 656, name: 'Commercial Bank of Ethiopia (CBE)' },
  { id: 655, name: 'Awash Bank' },
  { id: 654, name: 'Dashen Bank' },
  { id: 653, name: 'Bank of Abyssinia' },
  { id: 652, name: 'Wegagen Bank' },
  { id: 651, name: 'United Bank' },
  { id: 650, name: 'Nib International Bank' },
  { id: 649, name: 'Lion International Bank' },
  { id: 648, name: 'Cooperative Bank of Oromia (CBO)' },
  { id: 647, name: 'Oromia Bank' },
  { id: 646, name: 'Zemen Bank' },
  { id: 645, name: 'Bunna International Bank' },
  { id: 644, name: 'Berhan International Bank' },
  { id: 643, name: 'Abay Bank' },
  { id: 642, name: 'Addis International Bank' },
  { id: 641, name: 'Development Bank of Ethiopia (DBE)' },
  { id: 640, name: 'Enat Bank' },
  { id: 639, name: 'Amhara Bank' },
  { id: 638, name: 'Telebirr (Ethio Telecom)' },
  { id: 637, name: 'HelloCash (Somtel)' },
  { id: 636, name: 'M-PESA' },
];

let _banksCache = null;
let _banksCacheTime = 0;

async function getBanks() {
  const ONE_HOUR = 60 * 60 * 1000;
  if (_banksCache && Date.now() - _banksCacheTime < ONE_HOUR) return _banksCache;

  try {
    const response = await chapa.getBanks();
    if (response.data && response.data.length > 0) {
      _banksCache     = response.data;
      _banksCacheTime = Date.now();
      return _banksCache;
    }
  } catch (_) {}

  _banksCache     = ETHIOPIAN_BANKS;
  _banksCacheTime = Date.now();
  return _banksCache;
}

/**
 * Generate unique tx reference.
 */
function genPayRef(payrollId) {
  return `PAY-${String(payrollId).slice(-8).toUpperCase()}-${Date.now()}`;
}

module.exports = { initializeCheckout, verifyPayment, paySalary, payBulkSalary, verifyTransfer, getBanks, genPayRef, ETHIOPIAN_BANKS };
