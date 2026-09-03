const crypto = require('crypto');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');

// Helper: Generate conversation ID
const generateConversationId = (userId1, userId2) => {
  const sorted = [userId1, userId2].sort();
  return crypto.createHash('md5').update(sorted.join('-')).digest('hex');
};

// Helper: Check if user A follows user B
const isFollowing = (followerIds, targetUserId) => {
  return followerIds.includes(targetUserId);
};

// Helper: Determine message inbox type based on rules
const determineInboxType = (senderAccountType, receiverAccountType, senderFollowsReceiver) => {
  // Rule 1: Comedian to Comedian = connections (direct)
  if (senderAccountType === 'comedian' && receiverAccountType === 'comedian') {
    return 'connections';
  }
  
  // Rule 2: If sender follows receiver = messages (direct)
  if (senderFollowsReceiver) {
    return 'messages';
  }
  
  // Rule 3: Non-follower message = requests
  return 'requests';
};

// Send Message
exports.sendMessage = async (req, res) => {
  try {
    const { receiverId, text, mediaUrl, mediaType } = req.body;
    const senderId = req.user.id;

    if (!receiverId || !text.trim()) {
      return res.status(400).json({ message: 'Receiver ID and message text are required' });
    }

    // Get sender and receiver info
    const sender = await User.findOne({ id: senderId });
    const receiver = await User.findOne({ id: receiverId });

    if (!sender || !receiver) {
      return res.status(404).json({ message: 'Sender or receiver not found' });
    }

    if (senderId === receiverId) {
      return res.status(400).json({ message: 'Cannot message yourself' });
    }

    // Check if conversation exists
    const conversationId = generateConversationId(senderId, receiverId);
    let conversation = await Conversation.findOne({ conversationId });

    // Determine inbox type based on comedian rules
    const senderFollowsReceiver = isFollowing(sender.followingIds, receiverId);
    const inboxType = determineInboxType(sender.accountType, receiver.accountType, senderFollowsReceiver);

    // Create or update conversation
    if (!conversation) {
      conversation = new Conversation({
        conversationId,
        participants: {
          user1Id: senderId,
          user1Name: sender.name,
          user1Username: sender.username,
          user1ProfilePictureUrl: sender.profilePictureUrl,
          user1AccountType: sender.accountType,
          user2Id: receiverId,
          user2Name: receiver.name,
          user2Username: receiver.username,
          user2ProfilePictureUrl: receiver.profilePictureUrl,
          user2AccountType: receiver.accountType,
        },
        inboxTypes: {
          for_user1: 'messages',
          for_user2: inboxType,
        },
        isAccepted: {
          by_user1: true,
          by_user2: inboxType === 'messages' || inboxType === 'connections',
        },
      });
      await conversation.save();
    } else {
      // Update inbox type if needed
      conversation.inboxTypes.for_user2 = inboxType;
      if (inboxType === 'messages' || inboxType === 'connections') {
        conversation.isAccepted.by_user2 = true;
      }
      await conversation.save();
    }

    // Create message
    const message = new Message({
      conversationId,
      senderId,
      senderName: sender.name,
      senderUsername: sender.username,
      senderProfilePictureUrl: sender.profilePictureUrl,
      senderAccountType: sender.accountType,
      receiverId,
      text: text.trim(),
      mediaUrl: mediaUrl || '',
      mediaType: mediaType || '',
      inbox: inboxType,
      isAccepted: inboxType === 'messages' || inboxType === 'connections',
    });

    await message.save();

    // Update conversation last message
    conversation.lastMessage = text.substring(0, 100);
    conversation.lastMessageTime = new Date();
    conversation.lastMessageSenderId = senderId;
    await conversation.save();

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: {
        messageId: message._id,
        conversationId: conversation.conversationId,
        inbox: message.inbox,
      },
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Error sending message', error: error.message });
  }
};

// Get Conversations
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const { tab = 'messages' } = req.query; // messages, requests, connections

    let conversations;

    if (tab === 'connections') {
      conversations = await Conversation.find({
        $or: [
          { 'participants.user1Id': userId, 'inboxTypes.for_user1': 'connections' },
          { 'participants.user2Id': userId, 'inboxTypes.for_user2': 'connections' },
        ],
      }).sort({ updatedAt: -1 });
    } else if (tab === 'requests') {
      conversations = await Conversation.find({
        $or: [
          { 'participants.user1Id': userId, 'inboxTypes.for_user1': 'requests' },
          { 'participants.user2Id': userId, 'inboxTypes.for_user2': 'requests' },
        ],
      }).sort({ updatedAt: -1 });
    } else {
      // messages tab (default)
      conversations = await Conversation.find({
        $or: [
          { 'participants.user1Id': userId, 'inboxTypes.for_user1': 'messages' },
          { 'participants.user2Id': userId, 'inboxTypes.for_user2': 'messages' },
        ],
      }).sort({ updatedAt: -1 });
    }

    // Format conversations for frontend
    const formattedConversations = await Promise.all(conversations.map(async (conv) => {
      const isUser1 = conv.participants.user1Id === userId;
      const inboxType = isUser1 ? conv.inboxTypes.for_user1 : conv.inboxTypes.for_user2;
      const isAccepted = isUser1 ? conv.isAccepted.by_user1 : conv.isAccepted.by_user2;
      const otherUser = isUser1
        ? {
            id: conv.participants.user2Id,
            name: conv.participants.user2Name,
            username: conv.participants.user2Username,
            profilePictureUrl: conv.participants.user2ProfilePictureUrl,
            accountType: conv.participants.user2AccountType,
          }
        : {
            id: conv.participants.user1Id,
            name: conv.participants.user1Name,
            username: conv.participants.user1Username,
            profilePictureUrl: conv.participants.user1ProfilePictureUrl,
            accountType: conv.participants.user1AccountType,
          };

      const unreadCount = await Message.countDocuments({
        conversationId: conv.conversationId,
        receiverId: userId,
        isRead: false,
      });

      return {
        conversationId: conv.conversationId,
        otherUser,
        lastMessage: conv.lastMessage,
        lastMessageTime: conv.lastMessageTime,
        lastMessageSenderId: conv.lastMessageSenderId,
        inboxType,
        isAccepted,
        unreadCount,
        isUnread: unreadCount > 0,
      };
    }));

    res.status(200).json({
      success: true,
      data: formattedConversations,
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ message: 'Error fetching conversations', error: error.message });
  }
};

// Get Messages in Conversation
exports.getMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;
    const { limit = 50, skip = 0 } = req.query;

    const messages = await Message.find({ conversationId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    // Mark messages as read
    await Message.updateMany(
      { conversationId, receiverId: userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.status(200).json({
      success: true,
      data: messages.reverse(),
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Error fetching messages', error: error.message });
  }
};

// Accept Message Request
exports.acceptMessageRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;

    const conversation = await Conversation.findOne({ conversationId });

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const isUser1 = conversation.participants.user1Id === userId;

    if (isUser1) {
      conversation.isAccepted.by_user1 = true;
      conversation.inboxTypes.for_user1 = 'messages';
    } else {
      conversation.isAccepted.by_user2 = true;
      conversation.inboxTypes.for_user2 = 'messages';
    }

    // Update all messages in this conversation from requests to messages
    await Message.updateMany(
      { conversationId, receiverId: userId, inbox: 'requests' },
      { inbox: 'messages', isAccepted: true }
    );

    await conversation.save();

    res.status(200).json({
      success: true,
      message: 'Message request accepted',
      data: conversation,
    });
  } catch (error) {
    console.error('Accept message request error:', error);
    res.status(500).json({ message: 'Error accepting message request', error: error.message });
  }
};

// Reject/Delete Conversation
exports.deleteConversation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;

    const conversation = await Conversation.findOne({ conversationId });

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    // Delete all messages in conversation
    await Message.deleteMany({ conversationId });

    // Delete conversation
    await Conversation.deleteOne({ conversationId });

    res.status(200).json({
      success: true,
      message: 'Conversation deleted',
    });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ message: 'Error deleting conversation', error: error.message });
  }
};

// Get Unread Message Count
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const unreadCount = await Message.countDocuments({
      receiverId: userId,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      unreadCount,
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ message: 'Error fetching unread count', error: error.message });
  }
};

// Block User
exports.blockUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const { targetUserId } = req.body;

    const conversationId = generateConversationId(userId, targetUserId);
    const conversation = await Conversation.findOne({ conversationId });

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    conversation.blockedBy = userId;
    await conversation.save();

    res.status(200).json({
      success: true,
      message: 'User blocked',
    });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ message: 'Error blocking user', error: error.message });
  }
};

// Add Reaction to Message
exports.addReaction = async (req, res) => {
  try {
    const userId = req.user.id;
    const { messageId, emoji } = req.body;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Check if user already reacted with this emoji
    const existingReaction = message.reactions.find(
      (r) => r.userId === userId && r.emoji === emoji
    );

    if (existingReaction) {
      // Remove reaction if already exists
      message.reactions = message.reactions.filter(
        (r) => !(r.userId === userId && r.emoji === emoji)
      );
    } else {
      // Add new reaction
      message.reactions.push({ userId, emoji });
    }

    await message.save();

    res.status(200).json({
      success: true,
      data: {
        messageId: message._id,
        reactions: message.reactions,
      },
    });
  } catch (error) {
    console.error('Add reaction error:', error);
    res.status(500).json({ message: 'Error adding reaction', error: error.message });
  }
};

// Mark Message as Read (Explicit)
exports.markMessageAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { messageId } = req.params;

    const message = await Message.findByIdAndUpdate(
      messageId,
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    res.status(200).json({
      success: true,
      data: message,
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ message: 'Error marking message as read', error: error.message });
  }
};

// Set Typing Indicator
exports.setTypingIndicator = async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId, isTyping } = req.body;

    const conversation = await Conversation.findOne({ conversationId });
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const isUser1 = conversation.participants.user1Id === userId;
    if (isUser1) {
      conversation.typingIndicators.user1Typing = isTyping;
    } else {
      conversation.typingIndicators.user2Typing = isTyping;
    }

    await conversation.save();

    res.status(200).json({
      success: true,
      data: {
        conversationId,
        typingIndicators: conversation.typingIndicators,
      },
    });
  } catch (error) {
    console.error('Set typing indicator error:', error);
    res.status(500).json({ message: 'Error setting typing indicator', error: error.message });
  }
};

// Mute/Unmute Notifications
exports.toggleNotificationMute = async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;

    const conversation = await Conversation.findOne({ conversationId });
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const isUser1 = conversation.participants.user1Id === userId;
    if (isUser1) {
      conversation.muteNotifications.by_user1 = !conversation.muteNotifications.by_user1;
    } else {
      conversation.muteNotifications.by_user2 = !conversation.muteNotifications.by_user2;
    }

    await conversation.save();

    res.status(200).json({
      success: true,
      muted: isUser1
        ? conversation.muteNotifications.by_user1
        : conversation.muteNotifications.by_user2,
    });
  } catch (error) {
    console.error('Toggle mute error:', error);
    res.status(500).json({ message: 'Error toggling notification mute', error: error.message });
  }
};
