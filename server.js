const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const { v4: uuidv4 } = require('uuid');

app.use(express.static('public'));

// Redirect root to a new room
app.get('/', (req, res) => {
  const roomId = uuidv4().substr(0, 8); // Shorten UUID for simplicity
  res.redirect(`/${roomId}`);
});

// Serve chat page for any room ID
app.get('/:roomId', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Track rooms and messages
const rooms = new Map();

io.on('connection', (socket) => {
  let roomId = null;
  let username = `Guest-${Math.floor(Math.random() * 1000)}`;

  // Join room when client connects
  socket.on('joinRoom', (receivedRoomId) => {
    roomId = receivedRoomId;
    if (!rooms.has(roomId)) {
      rooms.set(roomId, { messages: [], participants: 0 });
    }
    const room = rooms.get(roomId);
    room.participants++;
    socket.join(roomId);
    socket.emit('messageHistory', room.messages);
  });

  // Handle messages
  socket.on('sendMessage', (text) => {
    const sanitizedText = escapeHtml(text);
    const message = {
      user: username,
      text: sanitizedText,
      timestamp: Date.now()
    };
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.messages.push(message);
      io.to(roomId).emit('receiveMessage', message);
    }
  });

  // Handle disconnections
  socket.on('disconnect', () => {
    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.participants--;
      if (room.participants <= 0) {
        setTimeout(() => {
          if (room.participants === 0) rooms.delete(roomId);
        }, 5 * 60 * 1000); // Delete room after 5 minutes
      }
    }
  });
});

// Sanitize user input
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Running on http://localhost:${PORT}`));