const mongoose = require('mongoose');
const User = require('../models/User');

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    console.log('MONGO_URI not set. Skipping MongoDB connection.');
    return false;
  }

  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });

    const indexes = await User.collection.indexes();
    const legacyEmailIndex = indexes.find((index) => index.name === 'email_1' && index.unique);
    if (legacyEmailIndex) await User.collection.dropIndex(legacyEmailIndex.name);
    await User.collection.createIndex({ email: 1 }, { name: 'email_1' });

    console.log('✅ MongoDB connected successfully');
    console.log(`📡 Database host: ${mongoose.connection.host}`);
    console.log(`🗄️  Database name: ${mongoose.connection.name}`);
    return true;
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    return false;
  }
};

module.exports = connectDB;
