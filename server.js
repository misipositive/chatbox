const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const { v4: uuidv4 } = require('uuid');

// Important: Define the root redirect BEFORE setting up static files
app.get('/', (req, res) => {
  const roomId = uuidv4().substr(0, 8);
  console.log(`Redirecting from root to room: ${roomId}`);
  return res.redirect(`/${roomId}`);
});

// Serve static files AFTER the root redirect
app.use(express.static('public'));

// Room-specific route
app.get('/:roomId', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

const rooms = new Map();

io.on('connection', (socket) => {
  let roomId = null;
  let username = null;

  socket.on('joinRoom', (receivedRoomId, providedName) => {
    roomId = receivedRoomId;
    username = providedName || `Guest-${Math.floor(1000 + Math.random() * 9000)}`;
    socket.username = username;
    if (!rooms.has(roomId)) {
      rooms.set(roomId, { participants: 0, usernames: new Set() });
    }
    const room = rooms.get(roomId);
    room.participants++;
    room.usernames.add(username);
    socket.join(roomId);
    broadcastGuestList(roomId);
    console.log(`[joinRoom] Room: ${roomId}, participants: ${room.participants} user: ${username}`);
  });

  socket.on('disconnect', () => {
    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.participants--;
      if (room.usernames && socket.username) {
        room.usernames.delete(socket.username);
      }
      if (room.participants <= 0) {
        rooms.delete(roomId);
        console.log(`[disconnect] Room: ${roomId} deleted`);
      } else {
        broadcastGuestList(roomId);
        console.log(`[disconnect] Room: ${roomId}, participants: ${room.participants}`);
      }
    }
  });

  socket.on('sendMessage', (text) => {
    const message = {
      user: socket.username || `Guest-${Math.floor(1000 + Math.random() * 9000)}`,
      text: escapeHtml(text),
      timestamp: Date.now()
    };
    if (roomId && rooms.has(roomId)) {
      io.to(roomId).emit('receiveMessage', message);
    }
  });

  function broadcastGuestList(roomId) {
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      const list = Array.from(room.usernames);
      io.to(roomId).emit('guestList', list);
      console.log(`[broadcastGuestList] Room: ${roomId}, users: ${list.join(", ")}`);
    }
  }
});

// Utility: escape HTML entities
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () =>
  console.log(`Running on http://localhost:${PORT}`)
);