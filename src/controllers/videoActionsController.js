const mongoose = require('mongoose');
const Video = require('../models/Video');
const Reshare = require('../models/Reshare');
const { toggleSavedVideo, getSavedVideoIds } = require('../services/savedStore');
const { findVideoById: findMemoryVideoById, updateLikeState, addCommentToVideo } = require('../services/videoStore');

const isMongoReady = () => mongoose.connection.readyState === 1 && typeof Video !== 'undefined';

const findVideoById = async (id) => {
  if (!isMongoReady()) {
    const video = await findMemoryVideoById(id);
    if (!video) {
      const error = new Error('Video not found');
      error.status = 404;
      throw error;
    }
    return video;
  }

  const video = await Video.findById(id).lean();
  if (!video) {
    const error = new Error('Video not found');
    error.status = 404;
    throw error;
  }
  return video;
};

const formatVideo = (video) => ({
  id: (video._id || video.id)?.toString?.() || video.id,
  title: video.title,
  creatorName: video.creatorName,
  category: video.category,
  description: video.description,
  mediaUrl: video.mediaUrl,
  thumbnailUrl: video.thumbnailUrl,
  views: Number(video.views || 0),
  likes: Number(video.likes || 0),
  comments: Number(video.comments || 0),
  likedBy: Array.isArray(video.likedBy) ? video.likedBy : [],
  commentThread: Array.isArray(video.commentThread) ? video.commentThread : [],
  type: video.type,
  createdAt: video.createdAt ? new Date(video.createdAt).toISOString() : undefined,
});

const incrementViews = async (req, res) => {
  try {
    if (!isMongoReady()) {
      const video = await findMemoryVideoById(req.params.id);
      if (!video) return res.status(404).json({ message: 'Video not found.' });
      video.views = Number(video.views || 0) + 1;
      return res.json(formatVideo(video));
    }

    const video = await Video.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } }, { new: true }).lean();
    if (!video) {
      return res.status(404).json({ message: 'Video not found.' });
    }
    return res.json(formatVideo(video));
  } catch (error) {
    console.error('incrementViews error:', error.message);
    return res.status(500).json({ message: 'Unable to update view count.' });
  }
};

const likeVideo = async (req, res) => {
  try {
    if (!isMongoReady()) {
      const video = await findMemoryVideoById(req.params.id);
      if (!video) {
        return res.status(404).json({ message: 'Video not found.' });
      }

      const likedBy = Array.isArray(video.likedBy) ? video.likedBy.map(String) : [];
      if (likedBy.includes(String(req.user.id))) {
        return res.json({ ...formatVideo(video), liked: true, message: 'You already liked this video.' });
      }

      const updated = await updateLikeState(req.params.id, req.user.id);
      return res.json({ ...formatVideo(updated), liked: true, message: 'Video liked.' });
    }

    const video = await Video.findById(req.params.id).lean();
    if (!video) {
      return res.status(404).json({ message: 'Video not found.' });
    }

    if (Array.isArray(video.likedBy) && video.likedBy.includes(req.user.id)) {
      return res.json({ ...formatVideo(video), liked: true, message: 'You already liked this video.' });
    }

    const updated = await Video.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { likedBy: req.user.id }, $inc: { likes: 1 } },
      { new: true }
    ).lean();

    return res.json({ ...formatVideo(updated), liked: true, message: 'Video liked.' });
  } catch (error) {
    console.error('likeVideo error:', error.message);
    return res.status(500).json({ message: 'Unable to like the video.' });
  }
};

const commentOnVideo = async (req, res) => {
  const { comment } = req.body || {};
  const cleanedComment = String(comment || '').trim();
  if (!cleanedComment) {
    return res.status(400).json({ message: 'Comment text is required.' });
  }

  try {
    if (!isMongoReady()) {
      const video = await findMemoryVideoById(req.params.id);
      if (!video) {
        return res.status(404).json({ message: 'Video not found.' });
      }

      const entry = {
        userId: req.user.id,
        userName: req.user.name || req.user.username || 'Creator',
        text: cleanedComment,
        createdAt: new Date(),
      };

      const updated = await addCommentToVideo(req.params.id, entry);
      return res.status(201).json({
        message: 'Comment created successfully.',
        comment: entry,
        video: formatVideo(updated),
      });
    }

    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ message: 'Video not found.' });
    }

    const commentEntry = {
      userId: req.user.id,
      userName: req.user.name || req.user.username || 'Creator',
      text: cleanedComment,
      createdAt: new Date(),
    };

    video.commentThread = Array.isArray(video.commentThread) ? video.commentThread : [];
    video.commentThread.push(commentEntry);
    video.comments = Number(video.comments || 0) + 1;
    await video.save();

    return res.status(201).json({
      message: 'Comment created successfully.',
      comment: commentEntry,
      video: formatVideo(video),
    });
  } catch (error) {
    console.error('commentOnVideo error:', error.message);
    return res.status(500).json({ message: 'Unable to comment on the video.' });
  }
};

const reshareVideo = async (req, res) => {
  try {
    const video = await findVideoById(req.params.id);
    const created = await Reshare.findOneAndUpdate(
      { userId: req.user.id, postId: video._id.toString() },
      { userId: req.user.id, postId: video._id.toString() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json({
      message: 'Post reshared.',
      reshared: Boolean(created),
      video: formatVideo(video),
    });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || 'Unable to reshare video.' });
  }
};

const toggleSaveVideo = async (req, res) => {
  try {
    const video = await findVideoById(req.params.id);
    const result = await toggleSavedVideo(req.user.token, req.params.id);
    return res.json({ ...result, video: formatVideo(video) });
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || 'Unable to save video.' });
  }
};

const getSavedVideos = async (req, res) => {
  try {
    const ids = await getSavedVideoIds(req.user.token);
    const videos = await Video.find({ _id: { $in: ids }, status: 'published' }).lean();
    return res.json(videos.map(formatVideo));
  } catch (error) {
    console.error('getSavedVideos error:', error.message);
    return res.status(500).json({ message: 'Unable to load saved videos.' });
  }
};

module.exports = {
  incrementViews,
  likeVideo,
  commentOnVideo,
  reshareVideo,
  toggleSaveVideo,
  getSavedVideos,
};
