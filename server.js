const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const { v4: uuidv4 } = require('uuid');

// Serve static files from 'public' directory
app.use(express.static('public'));

// Root: redirect to a new room
app.get('/', (req, res) => {
  const roomId = uuidv4().substr(0, 8);
  res.redirect(`/${roomId}`);
});

// Room: serve the chat page for any roomId
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
    socket.username = username; // Save on socket for message events

    if (!rooms.has(roomId)) {
      rooms.set(roomId, { participants: 0 });
    }
    rooms.get(roomId).participants++;
    socket.join(roomId);

    broadcastGuestCount(roomId);
    console.log(`[joinRoom] Room: ${roomId}, participants: ${rooms.get(roomId).participants} user: ${username}`);
  });

  socket.on('disconnect', () => {
    if (roomId && rooms.has(roomId)) {
      rooms.get(roomId).participants--;
      if (rooms.get(roomId).participants <= 0) {
        rooms.delete(roomId);
        console.log(`[disconnect] Room: ${roomId} deleted`);
      } else {
        broadcastGuestCount(roomId);
        console.log(`[disconnect] Room: ${roomId}, participants: ${rooms.get(roomId).participants}`);
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

  function broadcastGuestCount(roomId) {
    if (rooms.has(roomId)) {
      const count = rooms.get(roomId).participants;
      io.to(roomId).emit('guestCount', count);
      console.log(`[broadcastGuestCount] Room: ${roomId}, participants: ${count}`);
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