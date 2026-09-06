const mongoose = require('mongoose');

const comedianRatingSchema = new mongoose.Schema({
  comedianId: { type: String, required: true, index: true },
  raterId: { type: String, required: true, index: true },
  score: { type: Number, required: true, min: 1, max: 5 },
}, { timestamps: true });

comedianRatingSchema.index({ comedianId: 1, raterId: 1 }, { unique: true });

module.exports = mongoose.model('ComedianRating', comedianRatingSchema);
