const mongoose = require('mongoose');
const ComedianRating = require('../models/ComedianRating');

const memoryRatings = [];
const isMongoReady = () => mongoose.connection.readyState === 1;

const getRatingsForComedian = async (comedianId) => {
  if (!isMongoReady()) return memoryRatings.filter((rating) => rating.comedianId === comedianId);
  try {
    return await ComedianRating.find({ comedianId }).lean();
  } catch (error) {
    return memoryRatings.filter((rating) => rating.comedianId === comedianId);
  }
};

const upsertRating = async (comedianId, raterId, score) => {
  if (!isMongoReady()) {
    const existing = memoryRatings.find((rating) => rating.comedianId === comedianId && rating.raterId === raterId);
    if (existing) existing.score = score;
    else memoryRatings.push({ id: `rating_${Date.now()}`, comedianId, raterId, score, createdAt: new Date(), updatedAt: new Date() });
    return;
  }
  await ComedianRating.findOneAndUpdate(
    { comedianId, raterId },
    { $set: { score } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
};

const summarizeRatings = async (comedianId) => {
  const ratings = await getRatingsForComedian(comedianId);
  const ratingCount = ratings.length;
  const rating = ratingCount ? ratings.reduce((sum, item) => sum + item.score, 0) / ratingCount : null;
  return { rating, ratingCount };
};

module.exports = { getRatingsForComedian, upsertRating, summarizeRatings, memoryRatings };
