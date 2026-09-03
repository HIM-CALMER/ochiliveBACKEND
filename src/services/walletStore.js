const mongoose = require('mongoose');
const Wallet = require('../models/Wallet');
const WalletTransaction = require('../models/WalletTransaction');

const memoryWallets = new Map();
const isMongoReady = () => mongoose.connection.readyState === 1;

const getMemoryWallet = (userId) => {
  if (!memoryWallets.has(userId)) memoryWallets.set(userId, { userId, availableBalance: 0, pendingBalance: 0, lifetimeEarnings: 0, totalWithdrawn: 0, platformCommission: 0, recentTransactions: [], currency: 'NGN' });
  return memoryWallets.get(userId);
};

const getWallet = async (userId) => {
  if (!isMongoReady()) return getMemoryWallet(userId);
  try {
    const wallet = await Wallet.findOneAndUpdate({ userId }, { $setOnInsert: { userId } }, { new: true, upsert: true, lean: true });
    const recentTransactions = await WalletTransaction.find({ userId }).sort({ createdAt: -1 }).limit(50).lean();
    return { ...wallet, recentTransactions };
  } catch (error) {
    console.warn('MongoDB unavailable for getWallet, falling back to memory store:', error.message);
    return getMemoryWallet(userId);
  }
};

const creditWallet = async (userId, amount, reference, currency = 'NGN', metadata = {}) => {
  if (!isMongoReady()) {
    const wallet = getMemoryWallet(userId);
    if (wallet.recentTransactions.some((transaction) => transaction.reference === reference)) return wallet;
    const createdAt = new Date();
    wallet.availableBalance += amount;
    wallet.recentTransactions.unshift({ id: `txn_${Date.now()}`, reference, type: 'funding', amount, currency, status: 'settled', createdAt, date: createdAt.toISOString(), event: 'Funds added', source: 'Paystack', gross: amount, commission: 0, net: amount });
    wallet.recentTransactions = wallet.recentTransactions.slice(0, 50);
    return wallet;
  }
  const existing = await WalletTransaction.findOne({ userId, reference }).lean();
  if (!existing) {
    try {
      await WalletTransaction.create({ userId, reference, type: 'funding', amount, currency, status: 'settled', source: 'Paystack', metadata });
      await Wallet.findOneAndUpdate({ userId }, { $setOnInsert: { userId, currency }, $inc: { availableBalance: amount } }, { upsert: true });
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }
  return getWallet(userId);
};

module.exports = { getWallet, creditWallet, memoryWallets };