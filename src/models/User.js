const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true, minlength: 3, maxlength: 24, match: /^[a-z0-9_]+$/ },
  password: { type: String, required: true },
  profilePictureUrl: { type: String, default: '' },
  bio: { type: String, default: '' },
  followerIds: { type: [String], default: [] },
  followingIds: { type: [String], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
