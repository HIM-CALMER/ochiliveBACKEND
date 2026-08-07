const Video = require('../models/Video');
const { toggleSavedVideo, getSavedVideoIds } = require('../services/savedStore');

const findVideoById = async (id) => {
  const video = await Video.findById(id).lean();
  if (!video) {
    const error = new Error('Video not found');
    error.status = 404;
    throw error;
  }
  return video;
};

const formatVideo = (video) => ({
  id: video._id.toString(),
  title: video.title,
  creatorName: video.creatorName,
  category: video.category,
  description: video.description,
  mediaUrl: video.mediaUrl,
  thumbnailUrl: video.thumbnailUrl,
  views: video.views,
  likes: video.likes,
  comments: video.comments,
  type: video.type,
  createdAt: video.createdAt ? video.createdAt.toISOString() : undefined,
});

const incrementViews = async (req, res) => {
  try {
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
    const video = await Video.findByIdAndUpdate(req.params.id, { $inc: { likes: 1 } }, { new: true }).lean();
    if (!video) {
      return res.status(404).json({ message: 'Video not found.' });
    }
    return res.json(formatVideo(video));
  } catch (error) {
    console.error('likeVideo error:', error.message);
    return res.status(500).json({ message: 'Unable to like the video.' });
  }
};

const commentOnVideo = async (req, res) => {
  const { comment } = req.body || {};
  if (!comment?.trim()) {
    return res.status(400).json({ message: 'Comment text is required.' });
  }

  try {
    const video = await Video.findByIdAndUpdate(req.params.id, { $inc: { comments: 1 } }, { new: true }).lean();
    if (!video) {
      return res.status(404).json({ message: 'Video not found.' });
    }

    return res.status(201).json({
      message: 'Comment created successfully.',
      video: formatVideo(video),
    });
  } catch (error) {
    console.error('commentOnVideo error:', error.message);
    return res.status(500).json({ message: 'Unable to comment on the video.' });
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
  toggleSaveVideo,
  getSavedVideos,
};
