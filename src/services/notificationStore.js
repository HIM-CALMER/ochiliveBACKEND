const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const { emitToUser } = require('./realtime');

const memoryNotifications = [];
const isMongoReady = () => mongoose.connection.readyState === 1;

const createNotification = async (notification) => {
  if (!notification.recipientId || notification.recipientId === notification.actorId) return null;
  if (!isMongoReady()) {
    const entry = { ...notification, id: `notification_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, createdAt: new Date(), readAt: null };
    memoryNotifications.unshift(entry);
    emitToUser(entry.recipientId, 'notification:new', entry);
    return entry;
  }
  try {
    const created = (await Notification.create(notification)).toObject();
    const entry = { ...created, id: created._id.toString() };
    emitToUser(entry.recipientId, 'notification:new', entry);
    return entry;
  } catch (error) {
    console.warn('Unable to persist notification, falling back to memory store:', error.message);
    const entry = { ...notification, id: `notification_${Date.now()}`, createdAt: new Date(), readAt: null };
    memoryNotifications.unshift(entry);
    emitToUser(entry.recipientId, 'notification:new', entry);
    return entry;
  }
};

const listNotifications = async (recipientId, type) => {
  if (!isMongoReady()) return memoryNotifications.filter((item) => item.recipientId === recipientId && (!type || item.type === type)).slice(0, 100);
  try {
    return await Notification.find({ recipientId, ...(type ? { type } : {}) }).sort({ createdAt: -1 }).limit(100).lean();
  } catch (error) {
    return memoryNotifications.filter((item) => item.recipientId === recipientId && (!type || item.type === type)).slice(0, 100);
  }
};

const markNotificationRead = async (id, recipientId) => {
  if (!isMongoReady()) {
    const item = memoryNotifications.find((entry) => entry.id === id && entry.recipientId === recipientId);
    if (item) item.readAt = new Date();
    return item || null;
  }
  return Notification.findOneAndUpdate({ _id: id, recipientId }, { readAt: new Date() }, { new: true }).lean();
};

const markAllNotificationsRead = async (recipientId) => {
  if (!isMongoReady()) {
    memoryNotifications.filter((item) => item.recipientId === recipientId).forEach((item) => { item.readAt = new Date(); });
    return;
  }
  await Notification.updateMany({ recipientId, readAt: null }, { readAt: new Date() });
};

module.exports = { createNotification, listNotifications, markNotificationRead, markAllNotificationsRead, memoryNotifications };