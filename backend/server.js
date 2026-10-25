/**
 * Smart Irrigation & Farm Management System — Backend API Server
 * Stack: Node.js + Express + MongoDB (Mongoose)
 * Version: 2.0.0 — Ethiopian Agricultural Organisation Edition
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const express       = require('express');
const cors          = require('cors');
const helmet        = require('helmet');
const rateLimit     = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const connectDB     = require('./db/mongoose');
const { authenticate, requirePasswordChange } = require('./middleware/auth');

const http          = require('http');
const socketService = require('./utils/socketService');

const app    = express();
const server = http.createServer(app);
const PORT   = process.env.PORT || 5000;

// ── Trust Render/Vercel reverse proxy (required for rate limiting on Render) ──
app.set('trust proxy', 1);

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS ||
  process.env.FRONTEND_URL    ||
  'http://localhost:5173,http://localhost:5174'
).split(',').map(o => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    // Allow no-origin requests (mobile apps, curl, Render health checks)
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.some(allowed => origin === allowed || origin.endsWith('.vercel.app')))
      return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Body parsing — cap at 2 MB to allow base64 images ────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ── NoSQL injection sanitisation ──────────────────────────────────────────────
app.use(mongoSanitize());

// ── Global rate limiter — 200 req / 1 min per IP ─────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please slow down.' },
});
app.use('/api/', globalLimiter);

// ── Strict limiter for auth endpoints — 10 attempts / 15 min per IP ──────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Try again in 15 minutes.' },
});
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);

// ── Request logger ────────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  console.log(`  ${new Date().toLocaleTimeString()}  ${req.method.padEnd(7)} ${req.originalUrl}`);
  next();
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  const mongoose = require('mongoose');
  const dbState  = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({
    status:  'ok',
    time:    new Date().toISOString(),
    service: 'Smart Irrigation & Farm Management System API',
    db:      dbState[mongoose.connection.readyState] || 'unknown',
    version: '2.0.0',
  });
});

// ── Device reference endpoint ─────────────────────────────────────────────────
app.get('/api/device-info', (_req, res) => res.json({
  description: 'ESP8266 / Arduino Uno bidirectional endpoints',
  pushData:    `POST http://<server-ip>:${PORT}/api/sensors/:deviceId/data`,
  pollCommand: `GET  http://<server-ip>:${PORT}/api/sensors/:deviceId/command`,
  note:        'Contact your system administrator for the device API key.',
  pushBody: {
    apiKey: 'string (required)',
    type: 'ESP8266|Arduino Uno', zone: 'string',
    temp: '°C', humidity: '%', moisture: '%',
    flow: 'L/min', ph: '0-14', light: 'lux', pressure: 'hPa',
    waterLevel: '%', lcdMessage: 'string', sirenActive: 'boolean',
  },
}));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/users',    require('./routes/users'));
app.use('/api/employees', require('./routes/employees'));

app.use('/api/tasks',          authenticate, requirePasswordChange, require('./routes/tasks'));
app.use('/api/sensors',        authenticate, requirePasswordChange, require('./routes/sensors'));
app.use('/api/zones',          authenticate, requirePasswordChange, require('./routes/zones'));
app.use('/api/dashboard',      authenticate, requirePasswordChange, require('./routes/dashboard'));
app.use('/api/reports',        authenticate, requirePasswordChange, require('./routes/reports'));
app.use('/api/history',        authenticate, requirePasswordChange, require('./routes/history'));
app.use('/api/settings',       authenticate, requirePasswordChange, require('./routes/settings'));
app.use('/api/attendance',     authenticate, requirePasswordChange, require('./routes/attendance'));
app.use('/api/payroll',        authenticate, requirePasswordChange, require('./routes/payroll'));
app.use('/api/payroll/chapa/callback', require('./routes/payroll'));
app.use('/api/budget',         authenticate, requirePasswordChange, require('./routes/budget'));
app.use('/api/expenses',       authenticate, requirePasswordChange, require('./routes/expenses'));
app.use('/api/income',         authenticate, requirePasswordChange, require('./routes/income'));
app.use('/api/financial-audit',  authenticate, requirePasswordChange, require('./routes/financialAudit'));
app.use('/api/problem-reports',  authenticate, requirePasswordChange, require('./routes/problemReports'));

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ message: 'Endpoint not found.' }));

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  const isProd = process.env.NODE_ENV === 'production';
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({
    message: isProd && err.status !== 400
      ? 'Internal server error.'
      : (err.message || 'Internal server error.'),
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
async function startServer() {
  try {
    const startTime = Date.now();

    console.log('\n========================================');
    console.log('Smart Irrigation & Farm Management System');
    console.log('Version: 2.0.0');
    console.log('Ethiopian Agricultural Organisation Edition');
    console.log('========================================\n');

    console.log('Database:');
    console.log('  Status         : Connecting to MongoDB...');

    await connectDB();

    const mongoose = require('mongoose');
    console.log('  Status         : CONNECTED');
    console.log(`  Database       : ${mongoose.connection.name || 'IRRIGATION'}`);
    console.log('');

    // Initialise Socket.IO on the http server
    socketService.init(server, ALLOWED_ORIGINS);

    server.listen(PORT, () => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log('Server Configuration:');
      console.log(`  Environment    : ${process.env.NODE_ENV || 'development'}`);
      console.log(`  Node Version   : ${process.version}`);
      console.log(`  Port           : ${PORT}`);
      console.log(`  Server URL     : http://localhost:${PORT}`);
      console.log(`  API Base       : http://localhost:${PORT}/api`);
      console.log('');

      console.log('Security Features:');
      console.log('  [ACTIVE] Helmet security headers');
      console.log('  [ACTIVE] CORS protection');
      console.log('  [ACTIVE] Rate limiting (200 req/min global, 10 req/15min auth)');
      console.log('  [ACTIVE] NoSQL injection sanitization');
      console.log('  [ACTIVE] JWT authentication');
      console.log('');

      console.log('Registered API Endpoints:');
      console.log('  Authentication : /api/auth');
      console.log('  User Management: /api/users');
      console.log('  Core Features  : /api/tasks, /api/sensors, /api/zones');
      console.log('  Farm Operations: /api/dashboard, /api/reports, /api/history');
      console.log('  HR Management  : /api/employees, /api/attendance, /api/payroll');
      console.log('  Financial      : /api/budget, /api/expenses, /api/income, /api/financial-audit');
      console.log('  System         : /api/health, /api/settings, /api/device-info');
      console.log('');

      console.log('  [Socket.IO]    : ws://localhost:' + PORT + '  (real-time sensor events)');
      console.log('');
      console.log('========================================');
      console.log(`Server ready and accepting requests (${duration}s)`);
      console.log('========================================\n');
    });

  } catch (error) {
    console.error('\n[ERROR] Failed to start server:');
    console.error(`  ${error.message}`);
    console.error('\nShutting down...\n');
    process.exit(1);
  }
}

startServer();
