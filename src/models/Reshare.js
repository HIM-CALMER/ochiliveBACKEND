const mongoose = require('mongoose');

const reshareSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  postId: { type: String, required: true, index: true },
}, { timestamps: true });

reshareSchema.index({ userId: 1, postId: 1 }, { unique: true });

module.exports = mongoose.model('Reshare', reshareSchema);