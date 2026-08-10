const { verifyToken } = require('../utils/auth');
const { findById } = require('../services/userStore');

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split('Bearer ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  try {
    const payload = verifyToken(token);
    if (!payload) return res.status(401).json({ message: 'Invalid or expired session.' });
    return findById(payload.sub).then((user) => {
      if (!user) return res.status(401).json({ message: 'Account not found.' });
      req.user = { ...user, token };
      return next();
    }).catch(() => res.status(401).json({ message: 'Unable to validate session.' }));
  } catch {
    return res.status(401).json({ message: 'Invalid session.' });
  }
};

module.exports = authenticate;
