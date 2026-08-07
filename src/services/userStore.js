const User = require('../models/User');

const memoryUsers = [];
const pendingRegistrations = new Map();

const isMongoReady = () => typeof User !== 'undefined' && process.env.MONGO_URI;

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

const createUser = async (user) => {
  if (!isMongoReady()) {
    memoryUsers.push(user);
    return user;
  }

  const { id, ...payload } = user;

  try {
    const created = await User.create(payload);
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
  createUser,
  storePendingRegistration,
  getPendingRegistration,
  deletePendingRegistration,
};
