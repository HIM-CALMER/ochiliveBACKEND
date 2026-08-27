const mongoose = require('mongoose');
const User = require('../models/User');
const Video = require('../models/Video');
const Reshare = require('../models/Reshare');
const { findByUsername, searchUsers, updateById, updateRelationships, usernameExists } = require('../services/userStore');
const { countVideosByCreator, listVideosByCreator } = require('../services/videoStore');
const { getUsernameValidation, normalizeUsername } = require('../utils/usernamePolicy');
const { createNotification } = require('../services/notificationStore');

const isMongoReady = () => mongoose.connection.readyState === 1 && typeof Video !== 'undefined';

const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  username: user.username,
  bio: user.bio || '',
  profilePictureUrl: user.profilePictureUrl || '',
  accountType: user.accountType || 'creator',
  comedyProfile: user.comedyProfile || null,
});

const profilePayload = (user, viewerId) => ({
  user: publicUser(user),
  stats: {
    followers: Array.isArray(user.followerIds) ? user.followerIds.length : 0,
    following: Array.isArray(user.followingIds) ? user.followingIds.length : 0,
  },
  relationship: {
    isOwnProfile: user.id === viewerId,
    isFollowing: Array.isArray(user.followerIds) && user.followerIds.includes(viewerId),
    isFollowedBy: Array.isArray(user.followingIds) && user.followingIds.includes(viewerId),
    isMutual: Array.isArray(user.followerIds) && Array.isArray(user.followingIds) && user.followerIds.includes(viewerId) && user.followingIds.includes(viewerId),
  },
});

const getProfile = async (req, res) => {
  const username = req.params.username || req.user.username;
  const user = await findByUsername(username);
  if (!user) return res.status(404).json({ message: 'Profile not found.' });
  const payload = profilePayload(user, req.user.id);
  if (isMongoReady()) {
    payload.stats.posts = await Video.countDocuments({ creatorId: user.id, status: { $in: ['published', 'queued'] } });
  } else {
    payload.stats.posts = await countVideosByCreator(user.id);
  }
  return res.json(payload);
};

const updateProfile = async (req, res) => {
  const { name, username, bio, profilePictureUrl } = req.body || {};
  const updates = {};
  if (name !== undefined) {
    if (!name.trim()) return res.status(400).json({ message: 'Name cannot be empty.' });
    updates.name = name.trim();
  }
  if (username !== undefined) {
    const normalized = normalizeUsername(username);
    const validation = getUsernameValidation(normalized);
    if (!validation.valid) {
      if (validation.reason === 'reserved') return res.status(400).json({ message: 'That username is reserved by Ochi Live. Please choose another one.' });
      return res.status(400).json({ message: 'Username must be 3-24 characters using only letters, numbers, and underscores.' });
    }
    if (await usernameExists(normalized, req.user.id)) return res.status(409).json({ message: 'That username is already taken.' });
    updates.username = normalized;
  }
  if (bio !== undefined) updates.bio = String(bio).trim().slice(0, 160);
  if (profilePictureUrl !== undefined) updates.profilePictureUrl = String(profilePictureUrl).trim();
  try {
    const updated = await updateById(req.user.id, updates);
    if (!updated) return res.status(404).json({ message: 'Profile not found.' });
    return res.json(profilePayload(updated, req.user.id));
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'That username is already taken.' });
    return res.status(500).json({ message: 'Unable to update profile.' });
  }
};

const updateProfilePicture = async (req, res) => {
  const picture = req.file ? `/uploads/${req.file.filename}` : req.body?.profilePictureUrl;
  if (!picture) return res.status(400).json({ message: 'A profile picture is required.' });
  const updated = await updateById(req.user.id, { profilePictureUrl: picture });
  if (!updated) return res.status(404).json({ message: 'Profile not found.' });
  return res.json(profilePayload(updated, req.user.id));
};

const completeComedyOnboarding = async (req, res) => {
  const { comedyStyle, experience, influences, motivation, audience } = req.body || {};
  const answers = { comedyStyle, experience, influences, motivation, audience };
  if (Object.values(answers).some((value) => !String(value || '').trim())) {
    return res.status(400).json({ message: 'Please answer every comedy onboarding question.' });
  }

  const updated = await updateById(req.user.id, {
    accountType: 'comedian',
    comedyProfile: {
      comedyStyle: comedyStyle.trim(),
      experience: experience.trim(),
      influences: influences.trim(),
      motivation: motivation.trim(),
      audience: audience.trim(),
      completedAt: new Date(),
    },
  });
  if (!updated) return res.status(404).json({ message: 'Profile not found.' });
  return res.json({ ...profilePayload(updated, req.user.id), message: 'You are now a comedian on Ochi Live.' });
};

const followProfile = async (req, res) => {
  const target = await findByUsername(req.params.username);
  if (!target) return res.status(404).json({ message: 'Profile not found.' });
  if (target.id === req.user.id) return res.status(400).json({ message: 'You cannot follow yourself.' });
  const alreadyFollowing = Array.isArray(target.followerIds) && target.followerIds.includes(req.user.id);
  const targetFollowers = Array.from(new Set([...(target.followerIds || []), req.user.id]));
  const viewerFollowing = Array.from(new Set([...(req.user.followingIds || []), target.id]));
  const updated = await updateRelationships(target.id, { followerIds: targetFollowers });
  await updateRelationships(req.user.id, { followingIds: viewerFollowing });
  if (!alreadyFollowing) await createNotification({ recipientId: target.id, actorId: req.user.id, actorName: req.user.name, actorUsername: req.user.username, actorProfilePictureUrl: req.user.profilePictureUrl, type: 'follow' });
  return res.json({ ...profilePayload(updated, req.user.id), message: 'Profile followed.' });
};

const searchProfiles = async (req, res) => {
  const query = String(req.query?.q || '').trim();
  if (!query) return res.json({ query, results: [] });

  const users = await searchUsers(query, 12);
  const viewerId = req.user?.id;

  const results = (users || [])
    .filter((user) => user?.username && user?.id !== viewerId)
    .map((user) => {
      const isFollowing = Array.isArray(user.followerIds) && user.followerIds.includes(viewerId);
      const isFollowedBy = Array.isArray(user.followingIds) && user.followingIds.includes(viewerId);

      return {
        id: user.id,
        name: user.name,
        username: user.username,
        bio: user.bio || '',
        profilePictureUrl: user.profilePictureUrl || '',
        accountType: user.accountType || 'creator',
        isFollowing,
        isFollowedBy,
        isMutual: isFollowing && isFollowedBy,
        relationship: {
          isFollowing,
          isFollowedBy,
          isMutual: isFollowing && isFollowedBy,
        },
        stats: {
          followers: Array.isArray(user.followerIds) ? user.followerIds.length : 0,
          following: Array.isArray(user.followingIds) ? user.followingIds.length : 0,
        },
      };
    });

  return res.json({ query, results });
};

const unfollowProfile = async (req, res) => {
  const target = await findByUsername(req.params.username);
  if (!target) return res.status(404).json({ message: 'Profile not found.' });
  const targetFollowers = (target.followerIds || []).filter((id) => id !== req.user.id);
  const viewerFollowing = (req.user.followingIds || []).filter((id) => id !== target.id);
  const updated = await updateRelationships(target.id, { followerIds: targetFollowers });
  await updateRelationships(req.user.id, { followingIds: viewerFollowing });
  return res.json({ ...profilePayload(updated, req.user.id), message: 'Profile unfollowed.' });
};

const formatPost = (post) => ({
  id: post.id || post._id?.toString(),
  title: post.title,
  description: post.description || '',
  mediaUrl: post.mediaUrl,
  thumbnailUrl: post.thumbnailUrl || post.mediaUrl,
  category: post.category,
  duration: post.duration || '',
  createdAt: post.createdAt,
  type: post.type,
});

const getPosts = async (req, res) => {
  const user = await findByUsername(req.params.username);
  if (!user) return res.status(404).json({ message: 'Profile not found.' });
  if (!isMongoReady()) {
    const posts = await listVideosByCreator(user.id);
    return res.json(posts.map((post) => ({
      id: post.id || post._id,
      title: post.title,
      description: post.description || '',
      mediaUrl: post.mediaUrl,
      thumbnailUrl: post.thumbnailUrl || post.mediaUrl,
      category: post.category,
      duration: post.duration || '',
      createdAt: post.createdAt,
      type: post.type,
    })));
  }
  const posts = await Video.find({ creatorId: user.id, status: { $in: ['published', 'queued'] } }).sort({ createdAt: -1 }).lean();
  return res.json(posts.map(formatPost));
};

const getReshares = async (req, res) => {
  const user = await findByUsername(req.params.username);
  if (!user) return res.status(404).json({ message: 'Profile not found.' });
  if (!isMongoReady()) return res.json([]);
  const reshares = await Reshare.find({ userId: user.id }).sort({ createdAt: -1 }).lean();
  const posts = await Video.find({ id: { $in: reshares.map((item) => item.postId) } }).lean();
  const postMap = new Map(posts.map((post) => [post.id || post._id.toString(), post]));
  return res.json(reshares.map((item) => ({ ...formatPost(postMap.get(item.postId) || {}), resharedAt: item.createdAt })));
};

module.exports = { getProfile, updateProfile, updateProfilePicture, completeComedyOnboarding, followProfile, unfollowProfile, searchProfiles, getPosts, getReshares };