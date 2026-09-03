const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversationId: { type: String, required: true, index: true },
  senderId: { type: String, required: true, index: true },
  senderName: { type: String, default: '' },
  senderUsername: { type: String, default: '' },
  senderProfilePictureUrl: { type: String, default: '' },
  senderAccountType: { type: String, enum: ['creator', 'comedian'], default: 'creator' },
  receiverId: { type: String, required: true, index: true },
  text: { type: String, default: '', trim: true },
  mediaUrl: { type: String, default: '' },
  mediaType: { type: String, enum: ['image', 'video', 'audio', ''], default: '' },
  mediaThumbnail: { type: String, default: '' },
  isRead: { type: Boolean, default: false, index: true },
  readAt: { type: Date, default: null },
  inbox: { type: String, enum: ['messages', 'requests', 'connections'], default: 'messages' },
  isAccepted: { type: Boolean, default: false },
  reactions: [{
    userId: String,
    emoji: String,
    createdAt: { type: Date, default: Date.now }
  }],
  isEdited: { type: Boolean, default: false },
  editedAt: { type: Date, default: null },
  replyTo: { type: mongoose.Schema.Types.ObjectId, default: null }, // For message threading
}, { timestamps: true });

messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ receiverId: 1, inbox: 1, isRead: 1 });
messageSchema.index({ senderId: 1, receiverId: 1 });

module.exports = mongoose.model('Message', messageSchema);
