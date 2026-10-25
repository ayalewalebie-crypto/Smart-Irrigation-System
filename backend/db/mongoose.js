const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

async function connectDB() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('  ❌ MONGODB_URI is not set in backend/.env');
    process.exit(1);
  }

  // Atlas-optimised connection options
  const opts = {
    serverSelectionTimeoutMS: 30000,  // 30 s — allows for Atlas cold-start
    connectTimeoutMS:         20000,
    socketTimeoutMS:          45000,
    maxPoolSize:              10,
    retryWrites:              true,
    w:                        'majority',
    tls:                      true,
    tlsAllowInvalidCertificates: process.env.NODE_ENV !== 'production', // allow on dev (Windows CA issue)
  };

  try {
    await mongoose.connect(MONGODB_URI, opts);
    console.log(`  ✅ MongoDB connected: ${mongoose.connection.host}`);
    console.log(`  Database       : ${mongoose.connection.name}`);
  } catch (err) {
    // Redact credentials from the error message before printing
    const safe = err.message
      .replace(/mongodb\+srv:\/\/[^@]+@/, 'mongodb+srv://****:****@')
      .replace(/mongodb:\/\/[^@]+@/,      'mongodb://****:****@');

    console.error(`  ❌ MongoDB connection failed: ${safe}`);

    if (safe.includes('whitelist') || safe.includes('IP') || safe.includes('ECONNREFUSED') || safe.includes('ETIMEDOUT')) {
      console.error('');
      console.error('  ► Your IP is probably not whitelisted in Atlas.');
      console.error('  ► Fix: cloud.mongodb.com → Security → Network Access → + ADD IP → Allow Access from Anywhere (0.0.0.0/0)');
      console.error(`  ► Your current public IP: run  curl ifconfig.me  to find it`);
    }

    process.exit(1);
  }
}

// ── Reconnect logging ─────────────────────────────────────────────────────────
mongoose.connection.on('disconnected', () => {
  console.warn('  ⚠️  MongoDB disconnected. Attempting to reconnect…');
});

mongoose.connection.on('reconnected', () => {
  console.log('  ✅ MongoDB reconnected.');
});

mongoose.connection.on('error', (err) => {
  console.error('  ❌ MongoDB error:', err.message);
});

module.exports = connectDB;
