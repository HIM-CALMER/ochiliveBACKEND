const savedVideosByToken = new Map();

const getSavedSet = (token) => {
  if (!savedVideosByToken.has(token)) {
    savedVideosByToken.set(token, new Set());
  }
  return savedVideosByToken.get(token);
};

const toggleSavedVideo = async (token, videoId) => {
  const savedSet = getSavedSet(token);

  if (savedSet.has(videoId)) {
    savedSet.delete(videoId);
    return { saved: false };
  }

  savedSet.add(videoId);
  return { saved: true };
};

const getSavedVideoIds = async (token) => {
  return Array.from(getSavedSet(token));
};

module.exports = {
  toggleSavedVideo,
  getSavedVideoIds,
};
