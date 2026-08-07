require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const apiRoutes = require('./routes');

const app = express();
app.use(express.json());
app.use(cors());

const DEFAULT_PORT = 5000;
const PORT = Number(process.env.PORT) || DEFAULT_PORT;

app.get('/', (req, res) => {
  res.send('Ochilive backend is running');
});

app.use('/api', apiRoutes);

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

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

  socket.on('disconnect', () => {
    clearInterval(interval);
    console.log('Socket disconnected:', socket.id);
  });
});

const startServer = (port) => {
  server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      const nextPort = port + 1;
      console.log(`Port ${port} is busy. Trying ${nextPort} instead.`);
      startServer(nextPort);
    } else {
      console.error(err);
      process.exit(1);
    }
  });
};

connectDB();
startServer(PORT);
