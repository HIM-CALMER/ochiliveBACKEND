const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipientId: { type: String, required: true, index: true },
  actorId: { type: String, required: true },
  actorName: { type: String, default: '' },
  actorUsername: { type: String, default: '' },
  actorProfilePictureUrl: { type: String, default: '' },
  type: { type: String, enum: ['like', 'comment', 'save', 'follow', 'follow-back', 'reshare', 'mention'], required: true },
  videoId: { type: String, default: '' },
  videoTitle: { type: String, default: '' },
  comment: { type: String, default: '' },
  readAt: { type: Date, default: null },
}, { timestamps: true });

notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, readAt: 1 });

module.exports = mongoose.model('Notification', notificationSchema);