const express = require('express');
const authenticate = require('../middleware/authGuard');
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
router.post('/:id/view', incrementViews);
router.post('/:id/like', authenticate, likeVideo);
router.post('/:id/comments', authenticate, commentOnVideo);
router.post('/:id/save', authenticate, toggleSaveVideo);
router.get('/saved', authenticate, getSavedVideos);

module.exports = router;
