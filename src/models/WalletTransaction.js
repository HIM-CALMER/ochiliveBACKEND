const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  reference: { type: String, required: true },
  type: { type: String, enum: ['funding', 'withdrawal', 'gift-purchase', 'gift-tip', 'earning', 'refund'], required: true },
  amount: { type: Number, required: true },
  currency: { type: String, required: true, uppercase: true },
  status: { type: String, enum: ['pending', 'settled', 'failed'], default: 'pending' },
  source: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

walletTransactionSchema.index({ userId: 1, createdAt: -1 });
walletTransactionSchema.index({ userId: 1, reference: 1 }, { unique: true });

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);