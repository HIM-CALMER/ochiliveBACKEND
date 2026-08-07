const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    creatorName: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true, default: 'General' },
    description: { type: String, trim: true, default: '' },
    mediaUrl: { type: String, required: true, trim: true },
    thumbnailUrl: { type: String, trim: true },
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    type: { type: String, enum: ['video', 'photo'], default: 'video' },
    status: { type: String, enum: ['published', 'queued', 'draft'], default: 'published' },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Video', videoSchema);
