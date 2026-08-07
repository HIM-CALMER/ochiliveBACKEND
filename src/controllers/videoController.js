const Video = require('../models/Video');

const getVideoFeed = async (req, res) => {
  try {
    const videos = await Video.find({ status: 'published' })
      .sort({ createdAt: -1 })
      .lean()
      .limit(50);

    const payload = videos.map(({ _id, __v, createdAt, ...video }) => ({
      id: _id.toString(),
      ...video,
      createdAt: createdAt ? createdAt.toISOString() : undefined,
    }));

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
    const video = await Video.create({
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
      status: 'queued',
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
