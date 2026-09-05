const express = require('express');
const authenticate = require('../middleware/authGuard');
const {
  getDashboardSummary,
  getDiscoverItems,
  getWalletSummary,
  initializeWalletFunding,
  verifyWalletFunding,
  walletFundingCallback,
  getProfileSummary,
  getNotifications,
  readNotification,
  readAllNotifications,
  getActivityFeed,
  uploadAsset,
} = require('../controllers/dashboardController');

const router = express.Router();

router.get('/summary', authenticate, getDashboardSummary);
router.get('/discover', authenticate, getDiscoverItems);
router.get('/wallet', authenticate, getWalletSummary);
router.get('/wallet/fund/callback', walletFundingCallback);
router.post('/wallet/fund/initialize', authenticate, initializeWalletFunding);
router.get('/wallet/fund/verify', authenticate, verifyWalletFunding);
router.get('/profile', authenticate, getProfileSummary);
router.get('/notifications', authenticate, getNotifications);
router.patch('/notifications/:id/read', authenticate, readNotification);
router.post('/notifications/read-all', authenticate, readAllNotifications);
router.get('/activity', authenticate, getActivityFeed);
router.post('/upload', authenticate, uploadAsset);

module.exports = router;
