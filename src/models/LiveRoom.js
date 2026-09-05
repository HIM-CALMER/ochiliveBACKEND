const mongoose = require('mongoose');

const liveRoomSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  hostId: { type: String, required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, default: '', trim: true, maxlength: 280 },
  format: { type: String, enum: ['standup', 'sketch', 'storytelling', 'crowd-work', 'open-mic'], default: 'standup' },
  visibility: { type: String, enum: ['public', 'followers', 'private'], default: 'public' },
  status: { type: String, enum: ['draft', 'ready', 'live', 'ended'], default: 'draft' },
  startedAt: { type: Date, default: null },
  endedAt: { type: Date, default: null },
  expiresAt: { type: Date, default: null, index: true },
  maxDurationMinutes: { type: Number, default: null, min: 1 },
  ticketPublishingEnabled: { type: Boolean, default: false },
  pricingMode: { type: String, enum: ['free', 'paid'], default: 'free' },
  viewerCount: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('LiveRoom', liveRoomSchema);