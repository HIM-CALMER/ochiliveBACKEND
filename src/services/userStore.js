const mongoose = require('mongoose');
const User = require('../models/User');

const memoryUsers = [];
const pendingRegistrations = new Map();

const isMongoReady = () => mongoose.connection.readyState === 1 && typeof User !== 'undefined';

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
  const normalized = String(query || '').trim();
  if (!normalized) return [];
  const safeQuery = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(safeQuery, 'i');

  if (!isMongoReady()) {
    return memoryUsers
      .filter((user) => regex.test(user.username) || regex.test(user.name) || regex.test(user.email))
      .slice(0, limit);
  }

  try {
    return await User.find({
      $or: [
        { username: regex },
        { name: regex },
        { email: regex },
      ],
    }).limit(limit).lean();
  } catch (error) {
    console.warn('MongoDB unavailable for searchUsers, falling back to memory store:', error.message);
    return memoryUsers
      .filter((user) => regex.test(user.username) || regex.test(user.name) || regex.test(user.email))
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
  if (!isMongoReady()) return memoryUsers.some((user) => user.username === normalized && user.id !== exceptId);
  try {
    return Boolean(await User.findOne({ username: normalized, ...(exceptId ? { id: { $ne: exceptId } } : {}) }).lean());
  } catch (error) {
    return memoryUsers.some((user) => user.username === normalized && user.id !== exceptId);
  }
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
    console.warn('MongoDB unavailable for createUser, falling back to memory store:', error.message);
    memoryUsers.push(user);
    return user;
  }
};

const storePendingRegistration = async (email, payload) => {
  pendingRegistrations.set(email, payload);
  return payload;
};

const getPendingRegistration = async (email) => pendingRegistrations.get(email) || null;

const deletePendingRegistration = async (email) => {
  pendingRegistrations.delete(email);
};

module.exports = {
  findByEmail,
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
};
