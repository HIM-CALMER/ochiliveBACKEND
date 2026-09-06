const express = require('express');
const authenticate = require('../middleware/authGuard');
const requireComedian = require('../middleware/comedianGuard');
const { createRoom, startRoom, endRoom } = require('../controllers/liveController');
const { getVideoFeed, uploadVideoPost } = require('../controllers/videoController');
const {
  incrementViews,
  likeVideo,
  commentOnVideo,
  toggleSaveVideo,
  getSavedVideos,
  reshareVideo,
} = require('../controllers/videoActionsController');

const router = express.Router();
const multer = require('multer');
const path = require('path');

const upload = multer({ dest: path.join(__dirname, '../uploads') });

router.get('/', getVideoFeed);
router.post('/upload', authenticate, uploadVideoPost);
// Accept single file uploads at /videos/upload-file
router.post('/upload-file', authenticate, upload.single('file'), async (req, res, next) => {
  // delegate to controller handler if present
  try {
    // build public path
    if (!req.file) return res.status(400).json({ message: 'No file provided.' });
    const publicPath = `/uploads/${req.file.filename}`;
    return res.status(201).json({ message: 'File uploaded.', url: publicPath });
  } catch (err) {
    return next(err);
  }
});
router.post('/live/rooms', authenticate, requireComedian, createRoom);
router.post('/live/rooms/:id/start', authenticate, requireComedian, startRoom);
router.post('/live/rooms/:id/end', authenticate, requireComedian, endRoom);
router.post('/:id/view', incrementViews);
router.post('/:id/like', authenticate, likeVideo);
router.post('/:id/reshare', authenticate, reshareVideo);
router.post('/:id/comments', authenticate, commentOnVideo);
router.post('/:id/save', authenticate, toggleSaveVideo);
router.get('/saved', authenticate, getSavedVideos);

module.exports = router;
