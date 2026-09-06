const mongoose = require('mongoose');
const LiveRoom = require('../models/LiveRoom');
const { getComedianAccess } = require('../config/comedianLevels');
const { findById, updateById } = require('../services/userStore');
const memoryRooms = [];
const isMongoReady = () => mongoose.connection.readyState === 1;

const getMonthStart = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
};

const countMonthlyStreams = async (hostId) => {
  const monthStart = getMonthStart();
  if (isMongoReady()) return LiveRoom.countDocuments({ hostId, startedAt: { $gte: monthStart } });
  return memoryRooms.filter((room) => room.hostId === hostId && room.startedAt && new Date(room.startedAt) >= monthStart).length;
};

const createRoom = async (req, res) => {
  const { title, description, format, visibility } = req.body || {};
  if (!title?.trim()) return res.status(400).json({ message: 'Add a title for your live room.' });

  const payload = {
      id: `room_${Date.now()}`,
      hostId: req.user.id,
      title: title.trim(),
      description: description?.trim() || '',
      format: format || 'standup',
      visibility: visibility || 'public',
      status: 'ready',
      maxDurationMinutes: null,
      expiresAt: null,
      ticketPublishingEnabled: false,
      pricingMode: 'free',
  };
  const access = getComedianAccess(req.user.comedyProfile);
  const monthlyStreams = await countMonthlyStreams(req.user.id);
  if (monthlyStreams >= access.monthlyStreamLimit) {
    return res.status(403).json({
      code: 'MONTHLY_STREAM_LIMIT_REACHED',
      message: `You have used all ${access.monthlyStreamLimit} live streams available for Level ${access.level} this month.`,
    });
  }
  payload.maxDurationMinutes = access.maxStreamMinutes;
  payload.ticketPublishingEnabled = access.ticketPublishingEnabled;
  payload.pricingMode = access.pricingMode;
  try {
    const room = isMongoReady() ? await LiveRoom.create(payload) : payload;
    if (!isMongoReady()) memoryRooms.push(room);
    return res.status(201).json({ room });
  } catch (error) {
    console.error('Unable to prepare live room:', error.message);
    return res.status(500).json({ message: 'Unable to prepare the live room.' });
  }
};

const startRoom = async (req, res) => {
  try {
    const access = getComedianAccess(req.user.comedyProfile);
    const monthlyStreams = await countMonthlyStreams(req.user.id);
    if (monthlyStreams >= access.monthlyStreamLimit) {
      return res.status(403).json({
        code: 'MONTHLY_STREAM_LIMIT_REACHED',
        message: `You have used all ${access.monthlyStreamLimit} live streams available for Level ${access.level} this month.`,
      });
    }
    const room = isMongoReady() ? await LiveRoom.findOneAndUpdate(
      { id: req.params.id, hostId: req.user.id, status: 'ready' },
      { $set: { status: 'live', startedAt: new Date(), expiresAt: new Date(Date.now() + access.maxStreamMinutes * 60 * 1000) } },
      { new: true, lean: true },
    ) : (() => {
      const item = memoryRooms.find((candidate) => candidate.id === req.params.id && candidate.hostId === req.user.id && candidate.status === 'ready');
      if (item) Object.assign(item, { status: 'live', startedAt: new Date(), expiresAt: new Date(Date.now() + access.maxStreamMinutes * 60 * 1000) });
      return item;
    })();
    if (!room) return res.status(404).json({ message: 'Live room is not ready to start.' });
    return res.status(200).json({ room, message: 'Live room started.' });
  } catch (error) {
    console.error('Unable to start live room:', error.message);
    return res.status(500).json({ message: 'Unable to start the live room.' });
  }
};

const endRoom = async (req, res) => {
  try {
    const room = isMongoReady()
      ? await LiveRoom.findOne({ id: req.params.id, hostId: req.user.id, status: 'live' }).lean()
      : memoryRooms.find((candidate) => candidate.id === req.params.id && candidate.hostId === req.user.id && candidate.status === 'live');
    if (!room) return res.status(404).json({ message: 'Live room is not active.' });

    const endedAt = new Date();
    const startedAt = new Date(room.startedAt);
    const elapsedMinutes = Math.max(0, Math.min(
      Math.ceil((endedAt.getTime() - startedAt.getTime()) / 60000),
      room.maxDurationMinutes || Number.MAX_SAFE_INTEGER,
    ));
    const completedRoom = isMongoReady()
      ? await LiveRoom.findOneAndUpdate(
        { id: room.id, hostId: req.user.id, status: 'live' },
        { $set: { status: 'ended', endedAt } },
        { new: true, lean: true },
      )
      : (() => {
        Object.assign(room, { status: 'ended', endedAt });
        return room;
      })();

    if (!completedRoom) return res.status(409).json({ message: 'This live room has already ended.' });
    const user = await findById(req.user.id);
    if (user?.accountType === 'comedian') {
      const comedyProfile = user.comedyProfile || {};
      await updateById(req.user.id, {
        comedyProfile: {
          ...comedyProfile,
          totalLiveMinutes: (comedyProfile.totalLiveMinutes || 0) + elapsedMinutes,
          completedLiveStreams: (comedyProfile.completedLiveStreams || 0) + 1,
        },
      });
    }
    return res.json({ room: completedRoom, durationMinutes: elapsedMinutes, message: 'Live room ended.' });
  } catch (error) {
    console.error('Unable to end live room:', error.message);
    return res.status(500).json({ message: 'Unable to end the live room.' });
  }
};

module.exports = { createRoom, startRoom, endRoom };