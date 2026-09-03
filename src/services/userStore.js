const mongoose = require('mongoose');
const User = require('../models/User');

const memoryUsers = [];
const pendingRegistrations = new Map();
const pendingRegistrationIdsByEmail = new Map();
const usernameReservations = new Map();
const passwordResets = new Map();

const isMongoReady = () => mongoose.connection.readyState === 1 && typeof User !== 'undefined';

const normalizeSearchText = (value) => String(value || '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/^@+/, '')
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const findByEmail = async (email) => {
  if (!isMongoReady()) {
    return memoryUsers.find((user) => user.email === email) || null;
  }

  try {
    return await User.findOne({ email }).lean();
  } catch (error) {
    console.warn('MongoDB unavailable for findByEmail, falling back to memory store:', error.message);
    return memoryUsers.find((user) => user.email === email) || null;
  }
};

const findUsersByEmail = async (email) => {
  if (!isMongoReady()) return memoryUsers.filter((user) => user.email === email);
  try {
    return await User.find({ email }).lean();
  } catch (error) {
    console.warn('MongoDB unavailable for findUsersByEmail, falling back to memory store:', error.message);
    return memoryUsers.filter((user) => user.email === email);
  }
};

const countUsersByEmail = async (email) => (await findUsersByEmail(email)).length;

const findById = async (id) => {
  if (!id) return null;
  if (!isMongoReady()) return memoryUsers.find((user) => user.id === id) || null;
  try {
    return await User.findOne({ id }).lean();
  } catch (error) {
    console.warn('MongoDB unavailable for findById, falling back to memory store:', error.message);
    return memoryUsers.find((user) => user.id === id) || null;
  }
};

const findByUsername = async (username) => {
  if (!username) return null;
  const normalized = username.toLowerCase();
  if (!isMongoReady()) return memoryUsers.find((user) => user.username === normalized) || null;
  try {
    return await User.findOne({ username: normalized }).lean();
  } catch (error) {
    console.warn('MongoDB unavailable for findByUsername, falling back to memory store:', error.message);
    return memoryUsers.find((user) => user.username === normalized) || null;
  }
};

const searchUsers = async (query, limit = 12) => {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];
  const terms = normalized.split(' ').filter(Boolean);
  const safeTerms = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regexes = safeTerms.map((term) => new RegExp(term, 'i'));
  const matchesUser = (user) => {
    const username = normalizeSearchText(user.username);
    const name = normalizeSearchText(user.name);
    const email = normalizeSearchText(user.email);
    const searchable = `${username} ${name} ${email}`;
    return regexes.every((regex) => regex.test(searchable));
  };
  const scoreUser = (user) => {
    const username = normalizeSearchText(user.username);
    const name = normalizeSearchText(user.name);
    if (username === normalized) return 0;
    if (username.startsWith(normalized)) return 1;
    if (name === normalized) return 2;
    if (name.startsWith(normalized)) return 3;
    return 4;
  };

  if (!isMongoReady()) {
    return memoryUsers
      .filter(matchesUser)
      .sort((first, second) => scoreUser(first) - scoreUser(second))
      .slice(0, limit);
  }

  try {
    return await User.find({
      $and: safeTerms.map((term) => ({
        $or: [
          { username: { $regex: term, $options: 'i' } },
          { name: { $regex: term, $options: 'i' } },
          { email: { $regex: term, $options: 'i' } },
        ],
      })),
    }).limit(Math.max(limit, 50)).lean().then((users) => users
      .filter(matchesUser)
      .sort((first, second) => scoreUser(first) - scoreUser(second))
      .slice(0, limit));
  } catch (error) {
    console.warn('MongoDB unavailable for searchUsers, falling back to memory store:', error.message);
    return memoryUsers
      .filter(matchesUser)
      .sort((first, second) => scoreUser(first) - scoreUser(second))
      .slice(0, limit);
  }
};

const updateById = async (id, updates) => {
  if (!isMongoReady()) {
    const user = memoryUsers.find((item) => item.id === id);
    if (user) Object.assign(user, updates);
    return user || null;
  }
  try {
    return await User.findOneAndUpdate({ id }, { $set: updates }, { new: true, lean: true });
  } catch (error) {
    console.warn('MongoDB unavailable for updateById, falling back to memory store:', error.message);
    const user = memoryUsers.find((item) => item.id === id);
    if (user) Object.assign(user, updates);
    return user || null;
  }
};

const updateRelationships = async (id, update) => {
  if (!isMongoReady()) {
    const user = memoryUsers.find((item) => item.id === id);
    if (user) {
      user.followerIds = update.followerIds || user.followerIds;
      user.followingIds = update.followingIds || user.followingIds;
    }
    return user || null;
  }
  try {
    return await User.findOneAndUpdate({ id }, { $set: update }, { new: true, lean: true });
  } catch (error) {
    console.warn('MongoDB unavailable for updateRelationships, falling back to memory store:', error.message);
    const user = memoryUsers.find((item) => item.id === id);
    if (user) Object.assign(user, update);
    return user || null;
  }
};

const usernameExists = async (username, exceptId) => {
  const normalized = username.toLowerCase();
  const reservation = usernameReservations.get(normalized);
  if (reservation && reservation.expiresAt > Date.now() && reservation.userId !== exceptId) return true;
  if (reservation && reservation.expiresAt <= Date.now()) usernameReservations.delete(normalized);
  if (!isMongoReady()) return memoryUsers.some((user) => user.username === normalized && user.id !== exceptId);
  try {
    return Boolean(await User.findOne({ username: normalized, ...(exceptId ? { id: { $ne: exceptId } } : {}) }).lean());
  } catch (error) {
    return memoryUsers.some((user) => user.username === normalized && user.id !== exceptId);
  }
};

const reserveUsername = async (username, email, expiresAt) => {
  const normalized = username.toLowerCase();
  const existing = usernameReservations.get(normalized);
  if (existing && existing.expiresAt > Date.now() && existing.email !== email) return false;
  usernameReservations.set(normalized, { email, expiresAt });
  return true;
};

const releaseUsernameReservation = async (username, email) => {
  const normalized = username.toLowerCase();
  const reservation = usernameReservations.get(normalized);
  if (reservation?.email === email) usernameReservations.delete(normalized);
};

const createUser = async (user) => {
  if (!isMongoReady()) {
    memoryUsers.push(user);
    return user;
  }

  try {
    const created = await User.create(user);
    return created.toObject();
  } catch (error) {
    if (error.code === 11000) throw error;
    console.warn('MongoDB unavailable for createUser, falling back to memory store:', error.message);
    memoryUsers.push(user);
    return user;
  }
};

const storePendingRegistration = async (email, payload) => {
  const previousId = pendingRegistrationIdsByEmail.get(email);
  if (previousId) pendingRegistrations.delete(previousId);
  pendingRegistrations.set(payload.id, payload);
  pendingRegistrationIdsByEmail.set(email, payload.id);
  return payload;
};

const getPendingRegistration = async (email) => {
  const id = pendingRegistrationIdsByEmail.get(email);
  return (id && pendingRegistrations.get(id)) || null;
};

const deletePendingRegistration = async (email) => {
  const id = pendingRegistrationIdsByEmail.get(email);
  if (id) pendingRegistrations.delete(id);
  pendingRegistrationIdsByEmail.delete(email);
};

const storePasswordReset = async (email, payload) => {
  passwordResets.set(email, payload);
  return payload;
};

const getPasswordReset = async (email) => passwordResets.get(email) || null;

const deletePasswordReset = async (email) => {
  passwordResets.delete(email);
};

module.exports = {
  findByEmail,
  findUsersByEmail,
  countUsersByEmail,
  findById,
  findByUsername,
  searchUsers,
  updateById,
  updateRelationships,
  usernameExists,
  createUser,
  storePendingRegistration,
  getPendingRegistration,
  deletePendingRegistration,
  reserveUsername,
  releaseUsernameReservation,
  storePasswordReset,
  getPasswordReset,
  deletePasswordReset,
};
