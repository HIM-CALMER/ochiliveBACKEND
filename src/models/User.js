const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true, minlength: 3, maxlength: 24, match: /^[a-z0-9_]+$/ },
  password: { type: String, required: true },
  profilePictureUrl: { type: String, default: '' },
  bio: { type: String, default: '' },
  accountType: { type: String, enum: ['creator', 'comedian'], default: 'creator' },
  comedyProfile: {
    level: { type: Number, default: 1, min: 1, max: 6 },
    levelName: { type: String, default: 'Rookie' },
    rating: { type: Number, default: null, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    totalLiveMinutes: { type: Number, default: 0, min: 0 },
    monthlyLiveStreams: { type: Number, default: 0, min: 0 },
    completedLiveStreams: { type: Number, default: 0, min: 0 },
    ticketPublishingEnabled: { type: Boolean, default: false },
    pricingMode: { type: String, enum: ['free', 'paid'], default: 'free' },
    comedyStyle: { type: String, default: '' },
    experience: { type: String, default: '' },
    influences: { type: String, default: '' },
    motivation: { type: String, default: '' },
    audience: { type: String, default: '' },
    completedAt: { type: Date, default: null },
  },
  followerIds: { type: [String], default: [] },
  followingIds: { type: [String], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
