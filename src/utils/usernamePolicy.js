const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'api',
  'discover',
  'help',
  'home',
  'live',
  'login',
  'ochilive',
  'official',
  'profile',
  'settings',
  'signup',
  'support',
  'wallet',
]);

const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;

const normalizeUsername = (username) => String(username || '').toLowerCase().trim();

const getUsernameValidation = (username) => {
  const normalized = normalizeUsername(username);
  if (!normalized) return { normalized, valid: false, reason: 'required' };
  if (!USERNAME_PATTERN.test(normalized)) return { normalized, valid: false, reason: 'format' };
  if (RESERVED_USERNAMES.has(normalized)) return { normalized, valid: false, reason: 'reserved' };
  return { normalized, valid: true, reason: null };
};

module.exports = {
  RESERVED_USERNAMES,
  USERNAME_PATTERN,
  normalizeUsername,
  getUsernameValidation,
};