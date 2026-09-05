const mongoose = require('mongoose');
const Video = require('../models/Video');
const LiveRoom = require('../models/LiveRoom');
const { createVideo, listPublishedVideos } = require('../services/videoStore');
const { findById } = require('../services/userStore');

const isMongoReady = () => mongoose.connection.readyState === 1 && typeof Video !== 'undefined';

const normalizeVideoPayload = (video) => {
  const id = video?._id ? video._id.toString() : video?.id;
  const createdAt = video?.createdAt ? new Date(video.createdAt).toISOString() : undefined;

  return {
    id,
    ...video,
    createdAt,
  };
};

const getForYouVideos = async () => {
  if (!isMongoReady()) {
    const videos = await listPublishedVideos();
    return videos.map((video) => normalizeVideoPayload(video));
  }

  const videos = await Video.find({ status: 'published' })
    .sort({ createdAt: -1 })
    .lean()
    .limit(50);

  return videos.map(({ _id, __v, createdAt, ...video }) => ({
    ...video,
    id: _id.toString(),
    createdAt: createdAt ? new Date(createdAt).toISOString() : undefined,
  }));
};

const getFollowingVideos = async (userId) => {
  if (!userId) return [];

  if (!isMongoReady()) {
    const videos = await listPublishedVideos();
    return videos
      .filter((video) => String(video.creatorId) === String(userId))
      .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))
      .slice(0, 25)
      .map((video) => normalizeVideoPayload(video));
  }

  const videos = await Video.find({ status: 'published', creatorId: userId })
    .sort({ createdAt: -1 })
    .lean()
    .limit(25);

  return videos.map(({ _id, __v, createdAt, ...video }) => ({
    ...video,
    id: _id.toString(),
    createdAt: createdAt ? new Date(createdAt).toISOString() : undefined,
  }));
};

const getRecentLiveRooms = async () => {
  const liveRooms = isMongoReady()
    ? await LiveRoom.find({ status: 'live', $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }).sort({ startedAt: -1 }).lean().limit(20)
    : [];

  const mapped = await Promise.all((liveRooms || []).map(async (room) => {
    const host = room.hostId ? await findById(room.hostId) : null;
    return {
      id: room.id || room._id?.toString?.(),
      creatorId: room.hostId,
      creatorName: host?.name || 'Live Creator',
      title: room.title || 'Live now',
      description: room.description || 'Join the room and watch the moment unfold.',
      category: 'Live',
      mediaUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80',
      thumbnailUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80',
      views: Number(room.viewerCount || 0),
      likes: 0,
      comments: 0,
      type: 'live',
      isLive: true,
      startedAt: room.startedAt ? new Date(room.startedAt).toISOString() : undefined,
      createdAt: room.startedAt ? new Date(room.startedAt).toISOString() : undefined,
    };
  }));

  return mapped;
};

const getTrendingVideos = async () => {
  if (!isMongoReady()) {
    const videos = await listPublishedVideos();
    return videos
      .sort((left, right) => (Number(right.likes || 0) + Number(right.views || 0)) - (Number(left.likes || 0) + Number(left.views || 0)))
      .slice(0, 25)
      .map((video) => normalizeVideoPayload(video));
  }

  const videos = await Video.find({ status: 'published' })
    .sort({ likes: -1, views: -1, createdAt: -1 })
    .lean()
    .limit(25);

  return videos.map(({ _id, __v, createdAt, ...video }) => ({
    ...video,
    id: _id.toString(),
    createdAt: createdAt ? new Date(createdAt).toISOString() : undefined,
  }));
};

const getVideoFeed = async (req, res) => {
  try {
    const mode = String(req.query.mode || 'for_you').toLowerCase();
    const validModes = ['for_you', 'following', 'trending', 'recent_live'];
    const selectedMode = validModes.includes(mode) ? mode : 'for_you';

    if (selectedMode === 'recent_live') {
      const payload = await getRecentLiveRooms();
      return res.json(payload);
    }

    if (selectedMode === 'trending') {
      const payload = await getTrendingVideos();
      return res.json(payload);
    }

    if (selectedMode === 'following') {
      const followingIds = Array.isArray(req.user?.followingIds) ? req.user.followingIds.map(String) : [];
      if (!followingIds.length) {
        return res.json([]);
      }

      if (!isMongoReady()) {
        const videos = await listPublishedVideos();
        const payload = videos
          .filter((video) => followingIds.includes(String(video.creatorId)))
          .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))
          .slice(0, 25)
          .map((video) => normalizeVideoPayload(video));
        return res.json(payload);
      }

      const videos = await Video.find({ status: 'published', creatorId: { $in: followingIds } })
        .sort({ createdAt: -1 })
        .lean()
        .limit(25);

      const payload = videos.map(({ _id, __v, createdAt, ...video }) => ({
        ...video,
        id: _id.toString(),
        createdAt: createdAt ? new Date(createdAt).toISOString() : undefined,
      }));

      return res.json(payload);
    }

    const payload = await getForYouVideos();
    return res.json(payload);
  } catch (error) {
    console.error('Error fetching video feed:', error.message);
    return res.status(500).json({ message: 'Unable to load video feed at this time.' });
  }
};

const uploadVideoPost = async (req, res) => {
  const { title, mediaUrl, thumbnailUrl, category, description, type } = req.body || {};
  const token = req.headers.authorization?.split('Bearer ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Authentication required to upload media.' });
  }

  if (!title?.trim() || !mediaUrl?.trim()) {
    return res.status(400).json({ message: 'Title and media URL are required.' });
  }

  try {
    const video = isMongoReady()
      ? await Video.create({
          creatorId: req.user?.id,
          title: title.trim(),
          creatorName: req.user?.name || 'Ochi Creator',
          category: category?.trim() || 'General',
          description: description?.trim() || '',
          mediaUrl: mediaUrl.trim(),
          thumbnailUrl: thumbnailUrl?.trim() || mediaUrl.trim(),
          type: type === 'photo' ? 'photo' : 'video',
          views: 0,
          likes: 0,
          comments: 0,
          status: 'published',
        })
      : await createVideo({
          creatorId: req.user?.id,
          title: title.trim(),
          creatorName: req.user?.name || 'Ochi Creator',
          category: category?.trim() || 'General',
          description: description?.trim() || '',
          mediaUrl: mediaUrl.trim(),
          thumbnailUrl: thumbnailUrl?.trim() || mediaUrl.trim(),
          type: type === 'photo' ? 'photo' : 'video',
          views: 0,
          likes: 0,
          comments: 0,
          status: 'published',
          createdAt: new Date(),
        });

    return res.status(201).json({ message: 'Media uploaded successfully.', upload: video });
  } catch (error) {
    console.error('Error uploading video post:', error.message);
    return res.status(500).json({ message: 'Unable to upload video at this time.' });
  }
};

module.exports = {
  getVideoFeed,
  uploadVideoPost,
};
