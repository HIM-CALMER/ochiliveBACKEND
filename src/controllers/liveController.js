const LiveRoom = require('../models/LiveRoom');
const memoryRooms = [];
const isMongoReady = () => Boolean(process.env.MONGO_URI);

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
  };
  try {
    const room = isMongoReady() ? await LiveRoom.create(payload) : payload;
    if (!isMongoReady()) memoryRooms.push(room);
    return res.status(201).json({ room });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to prepare the live room.' });
  }
};

const startRoom = async (req, res) => {
  try {
    const room = isMongoReady() ? await LiveRoom.findOneAndUpdate(
      { id: req.params.id, hostId: req.user.id, status: 'ready' },
      { $set: { status: 'live', startedAt: new Date() } },
      { new: true, lean: true },
    ) : (() => {
      const item = memoryRooms.find((candidate) => candidate.id === req.params.id && candidate.hostId === req.user.id && candidate.status === 'ready');
      if (item) Object.assign(item, { status: 'live', startedAt: new Date() });
      return item;
    })();
    if (!room) return res.status(404).json({ message: 'Live room is not ready to start.' });
    return res.status(200).json({ room, message: 'Live room started.' });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to start the live room.' });
  }
};

module.exports = { createRoom, startRoom };