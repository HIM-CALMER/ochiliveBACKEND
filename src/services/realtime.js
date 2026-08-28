let ioInstance = null;

const setRealtimeServer = (io) => {
  ioInstance = io;
};

const emitToUser = (userId, event, payload) => {
  if (!ioInstance || !userId) return;
  ioInstance.to(`user:${userId}`).emit(event, payload);
};

module.exports = { setRealtimeServer, emitToUser };