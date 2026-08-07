const express = require('express');
const authenticate = require('../middleware/authGuard');
const {
  getDashboardSummary,
  getDiscoverItems,
  getWalletSummary,
  getProfileSummary,
  getNotifications,
  getActivityFeed,
  uploadAsset,
} = require('../controllers/dashboardController');

const router = express.Router();

router.get('/summary', authenticate, getDashboardSummary);
router.get('/discover', authenticate, getDiscoverItems);
router.get('/wallet', authenticate, getWalletSummary);
router.get('/profile', authenticate, getProfileSummary);
router.get('/notifications', authenticate, getNotifications);
router.get('/activity', authenticate, getActivityFeed);
router.post('/upload', authenticate, uploadAsset);

module.exports = router;
