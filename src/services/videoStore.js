const memoryVideos = [];

const makeId = () => `video_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const normalizeVideo = (video = {}) => {
  const createdAt = video.createdAt ? new Date(video.createdAt) : new Date();
  const id = video.id || video._id?.toString?.() || makeId();
  const status = ['published', 'queued', 'draft'].includes(video.status) ? video.status : 'published';

  return {
    ...video,
    id,
    _id: id,
    title: String(video.title || 'Untitled post'),
    creatorId: String(video.creatorId || 'unknown'),
    creatorName: String(video.creatorName || 'Ochi creator'),
    category: String(video.category || 'General'),
    description: String(video.description || ''),
    mediaUrl: String(video.mediaUrl || ''),
    thumbnailUrl: String(video.thumbnailUrl || video.mediaUrl || ''),
    views: Number(video.views || 0),
    likes: Number(video.likes || 0),
    comments: Number(video.comments || 0),
    likedBy: Array.isArray(video.likedBy) ? video.likedBy.map(String) : [],
    commentThread: Array.isArray(video.commentThread) ? video.commentThread : [],
    type: video.type === 'photo' ? 'photo' : 'video',
    status,
    createdAt,
  };
};

const createVideo = async (video) => {
  const normalized = normalizeVideo({ ...video, id: video.id || makeId() });
  memoryVideos.push(normalized);
  return normalized;
};

const findVideoById = async (id) => {
  const match = memoryVideos.find((video) => String(video.id) === String(id));
  return match ? normalizeVideo(match) : null;
};

const listPublishedVideos = async () => {
  return [...memoryVideos]
    .filter((video) => video.status === 'published')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

const listVideosByCreator = async (creatorId) => {
  return [...memoryVideos]
    .filter((video) => video.creatorId === String(creatorId) && ['published', 'queued'].includes(video.status))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

const countVideosByCreator = async (creatorId) => {
  return (await listVideosByCreator(creatorId)).length;
};

const updateLikeState = async (videoId, userId) => {
  const video = memoryVideos.find((entry) => String(entry.id) === String(videoId));
  if (!video) return null;

  const alreadyLiked = Array.isArray(video.likedBy) && video.likedBy.includes(String(userId));
  if (alreadyLiked) return { ...normalizeVideo(video), liked: true };

  video.likedBy = Array.isArray(video.likedBy) ? [...video.likedBy, String(userId)] : [String(userId)];
  video.likes = Number(video.likes || 0) + 1;
  return { ...normalizeVideo(video), liked: true };
};

const addCommentToVideo = async (videoId, commentEntry) => {
  const video = memoryVideos.find((entry) => String(entry.id) === String(videoId));
  if (!video) return null;

  video.commentThread = Array.isArray(video.commentThread) ? [...video.commentThread, commentEntry] : [commentEntry];
  video.comments = Number(video.comments || 0) + 1;
  return normalizeVideo(video);
};

const clearVideoStore = () => {
  memoryVideos.length = 0;
};

module.exports = {
  memoryVideos,
  createVideo,
  findVideoById,
  listPublishedVideos,
  listVideosByCreator,
  countVideosByCreator,
  updateLikeState,
  addCommentToVideo,
  clearVideoStore,
};
