const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  conversationId: { type: String, required: true, unique: true, index: true },
  participants: {
    user1Id: { type: String, required: true },
    user1Name: { type: String, default: '' },
    user1Username: { type: String, default: '' },
    user1ProfilePictureUrl: { type: String, default: '' },
    user1AccountType: { type: String, enum: ['creator', 'comedian'], default: 'creator' },
    user2Id: { type: String, required: true },
    user2Name: { type: String, default: '' },
    user2Username: { type: String, default: '' },
    user2ProfilePictureUrl: { type: String, default: '' },
    user2AccountType: { type: String, enum: ['creator', 'comedian'], default: 'creator' },
  },
  lastMessage: { type: String, default: '' },
  lastMessageTime: { type: Date, default: null },
  lastMessageSenderId: { type: String, default: '' },
  blockedBy: { type: String, default: null }, // userId who blocked the other
  conversationType: { type: String, enum: ['direct', 'group'], default: 'direct' },
  inboxTypes: {
    for_user1: { type: String, enum: ['messages', 'requests', 'connections'], default: 'messages' },
    for_user2: { type: String, enum: ['messages', 'requests', 'connections'], default: 'messages' },
  },
  isAccepted: {
    by_user1: { type: Boolean, default: false },
    by_user2: { type: Boolean, default: false },
  },
  typingIndicators: {
    user1Typing: { type: Boolean, default: false },
    user2Typing: { type: Boolean, default: false },
  },
  muteNotifications: {
    by_user1: { type: Boolean, default: false },
    by_user2: { type: Boolean, default: false },
  },
}, { timestamps: true });

conversationSchema.index({ 'participants.user1Id': 1, 'participants.user2Id': 1 });
conversationSchema.index({ 'participants.user1Id': 1, updatedAt: -1 });
conversationSchema.index({ 'participants.user2Id': 1, updatedAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
