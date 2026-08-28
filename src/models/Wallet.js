const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  currency: { type: String, default: 'NGN', uppercase: true },
  availableBalance: { type: Number, default: 0, min: 0 },
  pendingBalance: { type: Number, default: 0, min: 0 },
  lifetimeEarnings: { type: Number, default: 0, min: 0 },
  totalWithdrawn: { type: Number, default: 0, min: 0 },
  platformCommission: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Wallet', walletSchema);