require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { verifyToken } = require('./utils/auth');
const { findById } = require('./services/userStore');
const { setRealtimeServer } = require('./services/realtime');
const connectDB = require('./config/db');
const apiRoutes = require('./routes');

const app = express();
app.use('/uploads', express.static(require('path').join(__dirname, 'uploads')));
app.use(express.json());

const normalizeOrigins = (value) => {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const getAllowedOrigins = () => {
  const configuredOrigins = normalizeOrigins(process.env.CORS_ORIGIN);
  const defaultOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ];

  return Array.from(new Set([...defaultOrigins, ...configuredOrigins]));
};

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  const allowed = new Set(getAllowedOrigins());
  return allowed.has(origin);
};

app.use(cors({
  origin(origin, callback) {
    if (!origin || isAllowedOrigin(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origin ${origin} is not allowed by CORS.`));
  },
  credentials: true,
}));

const DEFAULT_PORT = 5000;
const PORT = Number(process.env.PORT) || DEFAULT_PORT;

app.get('/', (req, res) => {
  res.send('Ochilive backend is running');
});

app.use('/api', apiRoutes);

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin(origin, callback) {
      if (!origin || isAllowedOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} is not allowed by Socket.IO CORS.`));
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

setRealtimeServer(io);

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    const payload = token ? verifyToken(token) : null;
    if (!payload) return next(new Error('Authentication required.'));
    const user = await findById(payload.sub);
    if (!user) return next(new Error('Account not found.'));
    socket.userId = user.id;
    return next();
  } catch (error) {
    return next(new Error('Invalid session.'));
  }
});

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id, 'User:', socket.userId);
  socket.join(`user:${socket.userId}`);

  socket.emit('dashboard:update', {
    totals: {
      liveRooms: 18,
      viewers: 12400,
      walletBalance: 12480,
    },
  });

  const interval = setInterval(() => {
    socket.emit('dashboard:update', {
      totals: {
        liveRooms: 18 + Math.floor(Math.random() * 3),
        viewers: 12400 + Math.floor(Math.random() * 250),
        walletBalance: 12480 + Math.floor(Math.random() * 300),
      },
    });
  }, 15000);

  // ===== MESSAGING EVENTS =====

  // Join conversation room
  socket.on('message:join-conversation', (data) => {
    const { conversationId } = data;
    socket.join(`conversation:${conversationId}`);
    socket.emit('message:joined-conversation', { conversationId });
  });

  // Leave conversation room
  socket.on('message:leave-conversation', (data) => {
    const { conversationId } = data;
    socket.leave(`conversation:${conversationId}`);
  });

  // Send real-time message to conversation
  socket.on('message:new-message', (data) => {
    const { conversationId, message } = data;
    io.to(`conversation:${conversationId}`).emit('message:received', {
      conversationId,
      message,
    });
  });

  // Typing indicator
  socket.on('message:typing', (data) => {
    const { conversationId, userId, isTyping } = data;
    io.to(`conversation:${conversationId}`).emit('message:user-typing', {
      conversationId,
      userId,
      isTyping,
    });
  });

  // Message reaction
  socket.on('message:reaction', (data) => {
    const { conversationId, messageId, emoji, userId } = data;
    io.to(`conversation:${conversationId}`).emit('message:reaction-added', {
      conversationId,
      messageId,
      emoji,
      userId,
    });
  });

  // Read receipt
  socket.on('message:read', (data) => {
    const { conversationId, messageId, userId } = data;
    io.to(`conversation:${conversationId}`).emit('message:marked-read', {
      conversationId,
      messageId,
      userId,
      readAt: new Date(),
    });
  });

  // Mark conversation as read
  socket.on('message:conversation-read', (data) => {
    const { conversationId, userId } = data;
    io.to(`user:${userId}`).emit('message:conversation-cleared', {
      conversationId,
    });
  });

  socket.on('disconnect', () => {
    clearInterval(interval);
    console.log('Socket disconnected:', socket.id);
  });
});

const startServer = (port) => {
  server.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on port ${port}`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. Another Ochi Live backend instance is running. Stop the stale server before starting a new one.`);
      process.exit(1);
    }

    console.error(err);
    process.exit(1);
  });
};

connectDB().finally(() => startServer(PORT));
