const crypto = require('crypto');

const createToken = (user) => crypto.createHash('sha256').update(`${user.email}:${Date.now()}`).digest('hex');

const sanitizeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
});

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const isStrongPassword = (value) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(value);

module.exports = {
  createToken,
  sanitizeUser,
  isValidEmail,
  isStrongPassword,
};
