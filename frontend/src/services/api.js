export const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

function sanitizeValue(v) {
  if (typeof v === 'string') return v.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  if (Array.isArray(v))      return v.map(sanitizeValue);
  if (v && typeof v === 'object') return sanitizeObj(v);
  return v;
}
function sanitizeObj(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, sanitizeValue(v)]));
}

const REQUEST_TIMEOUT_MS = 20_000;

async function request(path, options = {}) {
  const token      = localStorage.getItem('sis_token');
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      signal: controller.signal,
      ...options,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError')
      throw new Error('Request timed out. Please check your connection and try again.');
    throw new Error('Server offline or unreachable. Please try again later.');
  } finally {
    clearTimeout(timeoutId);
  }

  if (res.status === 401) {
    const body = await res.json().catch(() => ({}));
    const msg  = body.message || '';
    if (msg.toLowerCase().includes('token') || msg.toLowerCase().includes('sign in')) {
      localStorage.removeItem('sis_token');
      localStorage.removeItem('sis_user');
      window.location.href = '/login';
    }
    throw new Error(msg || 'Unauthorized');
  }

  if (res.status === 429) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || 'Too many requests. Please slow down.');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `Request failed (${res.status})`);
  }

  if (res.status === 204) return null;
  return res.json();
}

const get    = (path)       => request(path);
const post   = (path, body) => request(path, { method: 'POST',   body: JSON.stringify(sanitizeObj(body)) });
const put    = (path, body) => request(path, { method: 'PUT',    body: JSON.stringify(sanitizeObj(body)) });
const patch  = (path, body) => request(path, { method: 'PATCH',  body: JSON.stringify(sanitizeObj(body)) });
const del    = (path)       => request(path, { method: 'DELETE' });

export const authApi = {
  login:               (email, password)  => post('/auth/login', { email, password }),
  register:            (data)             => post('/auth/register', data),
  me:                  ()                 => get('/auth/me'),
  updateProfile:       (data)             => put('/auth/me', data),
  changePassword:      (data)             => put('/auth/me/password', data),
  forceChangePassword: (data)             => put('/auth/me/force-change-password', data),
};

export const dashboardApi = {
  getSummary:    () => get('/dashboard'),
  getActivity:   () => get('/dashboard/activity'),
  getWaterChart: () => get('/dashboard/water-chart'),
  getWeather:    () => get('/dashboard/weather'),
};

export const sensorApi = {
  getAll:           ()                  => get('/sensors'),
  getOne:           (id)                => get(`/sensors/${id}`),
  create:           (data)              => post('/sensors', data),
  update:           (id, data)          => patch(`/sensors/${id}`, data),
  remove:           (id)                => del(`/sensors/${id}`),
  getHistory:       (id, from, to)      => {
    const q = new URLSearchParams({ ...(from && { from }), ...(to && { to }) }).toString();
    return get(`/sensors/${id}/history${q ? '?' + q : ''}`);
  },
  irrigate:         (id, action, zoneId) => post(`/sensors/${id}/irrigate`, { action, zoneId }),
  pollCommand:      (deviceId)          => get(`/sensors/${deviceId}/command`),
  sirenControl:     (deviceId, action)  => post(`/sensors/${deviceId}/siren`, { action }),
  sendLcd:          (deviceId, message) => post(`/sensors/${deviceId}/lcd`, { message }),
  updateThresholds: (id, data)          => put(`/sensors/${id}/thresholds`, data),
};

export const zoneApi = {
  getAll:     ()           => get('/zones'),
  create:     (data)       => post('/zones', data),
  update:     (id, data)   => put(`/zones/${id}`, data),
  remove:     (id)         => del(`/zones/${id}`),
  removeAll:  ()           => del('/zones/all'),
  control:    (id, action) => post(`/zones/${id}/irrigate`, { action }),
  controlAll: (action)     => post('/zones/irrigate-all', { action }),
};

export const taskApi = {
  getAll:        ()                       => get('/tasks'),
  getMyTasks:    ()                       => get('/tasks/my-tasks'),
  getOne:        (id)                     => get(`/tasks/${id}`),
  create:        (data)                   => post('/tasks', data),
  update:        (id, data)               => put(`/tasks/${id}`, data),
  updateStatus:  (id, status, report = '') => patch(`/tasks/${id}/status`, { status, report }),
  reportProblem: (id, problemType, problemReport) => patch(`/tasks/${id}/problem-report`, { problemType, problemReport }),
  verify:        (id, note = '')          => patch(`/tasks/${id}/verify`, { note }),
  remove:        (id)                     => del(`/tasks/${id}`),
};

export const userApi = {
  getAll:      (params = {}) => {
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))
    ).toString();
    return get(`/users${q ? '?' + q : ''}`);
  },
  getPending:  ()            => get('/users/pending'),
  getOne:      (id)          => get(`/users/${id}`),
  create:      (data)        => post('/users', data),
  update:      (id, data)    => put(`/users/${id}`, data),
  remove:      (id)          => del(`/users/${id}`),
  approve:     (id)          => patch(`/users/${id}/approve`, {}),
  reject:      (id, reason)  => patch(`/users/${id}/reject`, { reason }),
  suspend:     (id)          => patch(`/users/${id}/suspend`, {}),
  activate:    (id)          => patch(`/users/${id}/activate`, {}),
  deactivate:  (id)          => patch(`/users/${id}/deactivate`, {}),
  changeRole:  (id, role)    => patch(`/users/${id}/role`, { role }),
};

export const employeeApi = {
  getAll:     (params = {}) => {
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))
    ).toString();
    return get(`/employees${q ? '?' + q : ''}`);
  },
  getMe:        ()          => get('/employees/me'),
  getOne:       (id)        => get(`/employees/${id}`),
  create:       (data)      => post('/employees', data),
  update:       (id, data)  => put(`/employees/${id}`, data),
  toggleActive: (id)        => patch(`/employees/${id}/activate`, {}),
  remove:       (id)        => del(`/employees/${id}`),
};

export const attendanceApi = {
  getAll:     (params = {}) => {
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))
    ).toString();
    return get(`/attendance${q ? '?' + q : ''}`);
  },
  getMe:          (params = {}) => {
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))
    ).toString();
    return get(`/attendance/me${q ? '?' + q : ''}`);
  },
  getMyAttendance:(params = {}) => {
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))
    ).toString();
    return get(`/attendance/my-attendance${q ? '?' + q : ''}`);
  },
  getSummary: (month, year)      => get(`/attendance/summary?month=${month}&year=${year}`),
  getMonthly: (empId, yearMonth) => get(`/attendance/monthly/${empId}/${yearMonth}`),
  getOne:     (id)               => get(`/attendance/${id}`),
  create:     (data)             => post('/attendance', data),
  createBulk: (date, records)    => post('/attendance/bulk', { date, records }),
  update:     (id, data)         => put(`/attendance/${id}`, data),
  remove:     (id)               => del(`/attendance/${id}`),
};

export const payrollApi = {
  getAll:     (params = {}) => {
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))
    ).toString();
    return get(`/payroll${q ? '?' + q : ''}`);
  },
  getMy:        ()                      => get('/payroll/my'),
  getMyPayroll: ()                      => get('/payroll/my-payroll'),
  getSummary:   (payPeriod)             => get(`/payroll/summary${payPeriod ? '?payPeriod=' + payPeriod : ''}`),
  getOne:       (id)                    => get(`/payroll/${id}`),
  create:       (data)                  => post('/payroll', data),
  createBulk:   (payPeriod)             => post('/payroll/bulk', { payPeriod }),
  update:       (id, data)              => put(`/payroll/${id}`, data),
  submit:       (id)                    => patch(`/payroll/${id}/submit`, {}),
  approve:      (id)                    => patch(`/payroll/${id}/approve`, {}),
  reject:       (id, reason)            => patch(`/payroll/${id}/reject`, { reason }),
  pay:          (id)                    => patch(`/payroll/${id}/pay`, {}),
  chapaCheckout:(id)                    => patch(`/payroll/${id}/chapa-checkout`, {}),
  verifyPayment:(txRef)                 => get(`/payroll/chapa/verify-payment/${txRef}`),
  bulkPay:      (payPeriod)             => post('/payroll/bulk-pay', { payPeriod }),
  getBanks:     ()                      => get('/payroll/chapa/banks'),
  verifyTransfer:(txRef)                => get(`/payroll/chapa/verify/${txRef}`),
  remove:       (id)                    => del(`/payroll/${id}`),
};

export const problemReportApi = {
  getAll: (params = {}) => {
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))
    ).toString();
    return get(`/problem-reports${q ? '?' + q : ''}`);
  },
  getOne:       (id)                     => get(`/problem-reports/${id}`),
  create:       (data)                   => post('/problem-reports', data),
  updateStatus: (id, status, resolution) => patch(`/problem-reports/${id}/status`, { status, resolution }),
  remove:       (id)                     => del(`/problem-reports/${id}`),
};

export const budgetApi = {
  getAll:     (params = {}) => {
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))
    ).toString();
    return get(`/budget${q ? '?' + q : ''}`);
  },
  getSummary: (year)               => get(`/budget/summary${year ? '?year=' + year : ''}`),
  getOne:     (id)                 => get(`/budget/${id}`),
  create:     (data)               => post('/budget', data),
  update:     (id, data)           => put(`/budget/${id}`, data),
  approve:    (id)                 => patch(`/budget/${id}/approve`, {}),
  recordUse:  (id, categoryName, amount) => patch(`/budget/${id}/use`, { categoryName, amount }),
  remove:     (id)                 => del(`/budget/${id}`),
};

export const expenseApi = {
  getAll:     (params = {}) => {
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))
    ).toString();
    return get(`/expenses${q ? '?' + q : ''}`);
  },
  getSummary: (from, to)    => {
    const p = {};
    if (from) p.from = from;
    if (to)   p.to   = to;
    const q = new URLSearchParams(p).toString();
    return get(`/expenses/summary${q ? '?' + q : ''}`);
  },
  getOne:     (id)                  => get(`/expenses/${id}`),
  create:     (data)                => post('/expenses', data),
  update:     (id, data)            => put(`/expenses/${id}`, data),
  submit:     (id)                  => patch(`/expenses/${id}/submit`, {}),
  approve:    (id)                  => patch(`/expenses/${id}/approve`, {}),
  reject:     (id, reason)          => patch(`/expenses/${id}/reject`, { reason }),
  pay:        (id, paymentRef = '') => patch(`/expenses/${id}/pay`, { paymentRef }),
  remove:     (id)                  => del(`/expenses/${id}`),
};

export const incomeApi = {
  getAll:     (params = {}) => {
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))
    ).toString();
    return get(`/income${q ? '?' + q : ''}`);
  },
  getSummary: (from, to)    => {
    const q = new URLSearchParams({...(from&&{from}),...(to&&{to})}).toString();
    return get(`/income/summary${q ? '?' + q : ''}`);
  },
  getOne:     (id)          => get(`/income/${id}`),
  create:     (data)        => post('/income', data),
  update:     (id, data)    => put(`/income/${id}`, data),
  remove:     (id)          => del(`/income/${id}`),
};

export const financialAuditApi = {
  getAll:    (params = {}) => {
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))
    ).toString();
    return get(`/financial-audit${q ? '?' + q : ''}`);
  },
  getPL:     (from, to)    => {
    const q = new URLSearchParams({...(from&&{from}),...(to&&{to})}).toString();
    return get(`/financial-audit/pl${q ? '?' + q : ''}`);
  },
  getSummary:(year, month) => {
    const q = new URLSearchParams({...(year&&{year}),...(month&&{month})}).toString();
    return get(`/financial-audit/summary${q ? '?' + q : ''}`);
  },
};

export const reportApi = {
  getWaterUsage:  (from, to) => get(`/reports/water?from=${from}&to=${to}`),
  getSensorLogs:  (from, to) => get(`/reports/sensor-logs?from=${from}&to=${to}`),
};

export const historyApi = {
  getAll: (params = {}) => {
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v))
    ).toString();
    return get(`/history${q ? '?' + q : ''}`);
  },
  remove:    (id) => del(`/history/${id}`),
  removeAll: ()   => del('/history'),
};

export const settingsApi = {
  get:  ()     => get('/settings'),
  save: (data) => put('/settings', data),
};

export function formatETB(amount) {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency: 'ETB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(n) {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('en-ET').format(n);
}
