const express = require('express');
const messageController = require('../controllers/messageController');
const authGuard = require('../middleware/authGuard');

const router = express.Router();

// All message routes require authentication
router.use(authGuard);

// Send message
router.post('/send', messageController.sendMessage);

// Get conversations (with tab filter)
router.get('/conversations', messageController.getConversations);

// Get messages in a conversation
router.get('/conversation/:conversationId', messageController.getMessages);

// Accept message request
router.put('/accept/:conversationId', messageController.acceptMessageRequest);

// Delete/Reject conversation
router.delete('/conversation/:conversationId', messageController.deleteConversation);

// Get unread count
router.get('/unread-count', messageController.getUnreadCount);

// Block user
router.post('/block', messageController.blockUser);

// Advanced Features

// Add/remove reaction to message
router.post('/reaction', messageController.addReaction);

// Mark message as read
router.put('/mark-read/:messageId', messageController.markMessageAsRead);

// Set typing indicator
router.post('/typing', messageController.setTypingIndicator);

// Toggle notification mute
router.put('/mute/:conversationId', messageController.toggleNotificationMute);

module.exports = router;
