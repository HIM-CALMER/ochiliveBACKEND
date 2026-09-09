const express = require('express');
const { AccessToken } = require('livekit-server-sdk');
const authenticate = require('../middleware/authGuard');
const requireComedian = require('../middleware/comedianGuard');
const LiveRoom = require('../models/LiveRoom');
const { createRoom, startRoom, endRoom } = require('../controllers/liveController');
const { getVideoFeed, uploadVideoPost } = require('../controllers/videoController');
const { getVideoThumbnailUrl, uploadBuffer } = require('../services/cloudinaryService');
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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (/^(video|image)\//.test(file.mimetype)) return callback(null, true);
    return callback(new Error('Only image and video files are supported.'));
  },
});

const ensureLiveKitConfig = () => {
  if (!process.env.LIVEKIT_URL || !process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
    throw new Error('LiveKit environment variables are missing. Configure LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET in backend/.env.');
  }
};

const createLiveKitToken = async (user, roomId, role = 'viewer') => {
  ensureLiveKitConfig();

  const token = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
    identity: String(user.id),
    name: user.name || user.username || 'Ochi Live viewer',
  });

  token.addGrant({
    room: String(roomId),
    roomJoin: true,
    canPublish: role === 'host',
    canSubscribe: true,
    canPublishData: role === 'host',
    canUpdateOwnMetadata: role === 'host',
  });

  return { token: await token.toJwt(), livekitUrl: process.env.LIVEKIT_URL };
};

const getRoomForToken = async (roomId, hostId = null) => {
  const query = { id: roomId };
  if (hostId) query.hostId = hostId;

  const room = await LiveRoom.findOne(query).lean();
  if (!room) {
    throw new Error('Live room not found.');
  }
  return room;
};

const issueHostToken = async (req, res) => {
  try {
    const room = await getRoomForToken(req.params.id, req.user.id);
    const payload = await createLiveKitToken(req.user, room.id, 'host');
    return res.json({
      roomId: room.id,
      roomName: room.id,
      ...payload,
      message: 'Host token generated.',
    });
  } catch (error) {
    const message = error?.message || 'Unable to generate the host token.';
    return res.status(error?.message === 'Live room not found.' ? 404 : 500).json({ message });
  }
};

const issueViewerToken = async (req, res) => {
  try {
    const room = await getRoomForToken(req.params.id);
    if (room.status !== 'live') {
      return res.status(409).json({ message: 'This live room is not active yet.' });
    }
    const payload = await createLiveKitToken(req.user, room.id, 'viewer');
    return res.json({
      roomId: room.id,
      roomName: room.id,
      ...payload,
      message: 'Viewer token generated.',
    });
  } catch (error) {
    const message = error?.message || 'Unable to generate the viewer token.';
    return res.status(error?.message === 'Live room not found.' ? 404 : 500).json({ message });
  }
};

router.get('/', authenticate, getVideoFeed);
router.post('/upload', authenticate, uploadVideoPost);
// Stream single media uploads to Cloudinary at /videos/upload-file.
const handleMediaUpload = (req, res, next) => {
  upload.single('file')(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'Media files must be 100 MB or smaller.' });
    }
    return res.status(400).json({ message: error.message || 'Unsupported media upload.' });
  });
};

router.post('/upload-file', authenticate, handleMediaUpload, async (req, res) => {
  try {
    // build public path
    if (!req.file) return res.status(400).json({ message: 'No file provided.' });
    const isVideo = req.file.mimetype.startsWith('video/');
    const resourceType = isVideo ? 'video' : 'image';
    const result = await uploadBuffer(req.file.buffer, {
      resourceType,
      folder: `ochi-live/${resourceType}s/${req.user.id}`,
    });
    const thumbnailUrl = isVideo ? getVideoThumbnailUrl(result.public_id) : result.secure_url;

    return res.status(201).json({
      message: 'File uploaded.',
      url: result.secure_url,
      mediaUrl: result.secure_url,
      thumbnailUrl,
      publicId: result.public_id,
      resourceType,
      duration: result.duration || null,
      width: result.width || null,
      height: result.height || null,
    });
  } catch (error) {
    console.error('Cloudinary media upload failed:', error.message);
    const status = error.message?.includes('not configured') ? 503 : 500;
    return res.status(status).json({ message: error.message || 'Unable to upload media.' });
  }
});
router.post('/live/rooms', authenticate, requireComedian, createRoom);
router.post('/live/rooms/:id/start', authenticate, requireComedian, startRoom);
router.post('/live/rooms/:id/end', authenticate, requireComedian, endRoom);
router.post('/live/rooms/:id/host-token', authenticate, requireComedian, issueHostToken);
router.post('/live/rooms/:id/viewer-token', authenticate, issueViewerToken);
router.post('/:id/view', incrementViews);
router.post('/:id/like', authenticate, likeVideo);
router.post('/:id/reshare', authenticate, reshareVideo);
router.post('/:id/comments', authenticate, commentOnVideo);
router.post('/:id/save', authenticate, toggleSaveVideo);
router.get('/saved', authenticate, getSavedVideos);

module.exports = router;
