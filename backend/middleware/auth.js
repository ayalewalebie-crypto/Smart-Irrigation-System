const jwt = require('jsonwebtoken');
require('dotenv').config();
const ROLE_RANK = { owner: 4, admin: 3, office_manager: 2, labor: 1 };


function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'No token provided. Please sign in.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token expired or invalid. Please sign in again.' });
  }
}
function requirePasswordChange(req, res, next) {
  if (req.user && req.user.mustChangePassword) {
    if (req.path === '/me/force-change-password' || req.originalUrl.endsWith('/me/force-change-password')) {
      return next();
    }
    return res.status(403).json({
      code:    'MUST_CHANGE_PASSWORD',
      message: 'You must change your temporary password before accessing the system.',
    });
  }
  next();
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
  return res.status(403).json({ message: 'Access denied for your role.' });
    }
    next();
  };
}

function authorizeMinRank(minRole) {
  const min = ROLE_RANK[minRole] || 0;
  return (req, res, next) => {
    if ((ROLE_RANK[req.user?.role] || 0) < min) {
      return res.status(403).json({ message: 'Access denied for your role.' });
    }
    next();
  };
}

module.exports = { authenticate, requirePasswordChange, authorize, authorizeMinRank, ROLE_RANK };
