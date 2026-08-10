const express = require('express');
const authenticate = require('../middleware/authGuard');
const requireComedian = require('../middleware/comedianGuard');
const { createRoom, startRoom } = require('../controllers/liveController');
const { getVideoFeed, uploadVideoPost } = require('../controllers/videoController');
const {
  incrementViews,
  likeVideo,
  commentOnVideo,
  toggleSaveVideo,
  getSavedVideos,
} = require('../controllers/videoActionsController');

const router = express.Router();

router.get('/', getVideoFeed);
router.post('/upload', authenticate, uploadVideoPost);
router.post('/live/rooms', authenticate, requireComedian, createRoom);
router.post('/live/rooms/:id/start', authenticate, requireComedian, startRoom);
router.post('/:id/view', incrementViews);
router.post('/:id/like', authenticate, likeVideo);
router.post('/:id/comments', authenticate, commentOnVideo);
router.post('/:id/save', authenticate, toggleSaveVideo);
router.get('/saved', authenticate, getSavedVideos);

module.exports = router;
