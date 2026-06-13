require('dotenv').config();

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');

const roomManager  = require('./rooms/RoomManager');
const driveProxy   = require('./proxy/driveProxy');
const { registerSyncHandlers, clearRoomPointsTimer } = require('./sync/SyncController');
const { registerChatHandlers } = require('./chat/ChatController');
const { socketAuthMiddleware } = require('./middleware/authMiddleware');

const PORT = process.env.PORT || 3001;

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || '*', methods: ['GET', 'OPTIONS', 'POST'] }));
app.use(express.json());
app.use('/api', driveProxy);
app.get('/health', (_, res) => res.json({ ok: true, rooms: roomManager.rooms.size, uptime: process.uptime() }));

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.FRONTEND_URL || '*', methods: ['GET', 'POST'] },
  pingTimeout: 15000, pingInterval: 5000
});
io.use(socketAuthMiddleware);

// Таймери реконнекту тільки для хоста
const hostReconnectTimers = new Map();

function clearHostTimer(socketId) {
  const t = hostReconnectTimers.get(socketId);
  if (t) { clearTimeout(t); hostReconnectTimers.delete(socketId); }
}

io.on('connection', (socket) => {
  const user = socket.telegramUser;
  console.log(`[+] ${socket.id} (${user?.first_name || 'anon'})`);

  // ── Створення кімнати ──────────────────────────────────────
  socket.on('create_room', ({ videoUrl, userName }, callback) => {
    try {
      if (!videoUrl?.trim()) return callback({ error: 'videoUrl обовʼязковий' });
      const room = roomManager.createRoom(socket.id, videoUrl.trim());
      room.hostName = userName || user?.first_name || 'Host';
      socket.join(room.roomId);
      console.log(`[create_room] ${room.hostName} → ${room.roomId}`);
      callback({ ok: true, roomId: room.roomId, role: 'host', state: room.toClientState() });
    } catch (err) {
      console.error('[create_room]', err);
      callback({ error: 'Не вдалось створити кімнату' });
    }
  });

  // ── Вхід в кімнату ─────────────────────────────────────────
  socket.on('join_room', ({ roomId, userName }, callback) => {
    try {
      if (!roomId) return callback({ error: 'roomId обовʼязковий' });
      const room = roomManager.getRoom(roomId.toUpperCase());
      if (!room) return callback({ error: 'Кімнату не знайдено. Перевір код.' });

      // Дозволяємо зайти якщо слот вільний або старий сокет мертвий
      if (room.guestSocketId !== null && room.guestSocketId !== socket.id) {
        const oldSocket = io.sockets.sockets.get(room.guestSocketId);
        if (oldSocket?.connected) return callback({ error: 'В кімнаті вже два учасники' });
        room.guestSocketId = null; // старий мертвий — звільняємо
      }

      room.guestSocketId = socket.id;
      room.guestName = userName || user?.first_name || 'Guest';
      socket.join(roomId.toUpperCase());
      console.log(`[join_room] ${room.guestName} → ${room.roomId}`);

      socket.to(room.roomId).emit('user_joined', { userId: socket.id, userName: room.guestName });

      // toClientState() повертає getCurrentTime() з урахуванням elapsed —
      // гість одразу отримує актуальну позицію хоста
      callback({ ok: true, role: 'guest', state: room.toClientState(), hostName: room.hostName });
    } catch (err) {
      console.error('[join_room]', err);
      callback({ error: 'Не вдалось увійти в кімнату' });
    }
  });

  registerSyncHandlers(socket, io, roomManager);
  registerChatHandlers(socket, io, roomManager);

  // ── Disconnect ─────────────────────────────────────────────
  socket.on('disconnect', (reason) => {
    console.log(`[-] ${socket.id} | ${reason}`);
    const room = roomManager.findRoomBySocket(socket.id);
    if (!room) return;

    const isHost = room.isHost(socket.id);
    const uName  = isHost ? room.hostName : room.guestName;
    const roomId = room.roomId;

    socket.to(roomId).emit('user_disconnected', {
      userId: socket.id, userName: uName,
      role: isHost ? 'host' : 'guest', willReconnect: isHost
    });

    if (!isHost) {
      // Гість — одразу звільняємо слот (не чекаємо 30с)
      room.guestSocketId = null;
      io.to(roomId).emit('user_left', { userId: socket.id, userName: uName });
      return;
    }

    // Хост — 30с на реконнект
    clearHostTimer(socket.id);
    const timer = setTimeout(() => {
      hostReconnectTimers.delete(socket.id);
      const cur = roomManager.getRoom(roomId);
      if (!cur || cur.hostSocketId !== socket.id) return;
      console.log(`[disconnect] Хост ${uName} не повернувся → закриваємо ${roomId}`);
      clearRoomPointsTimer(roomId);
      io.to(roomId).emit('room_closed', { reason: 'host_left', message: `${uName} покинув кімнату` });
      roomManager.deleteRoom(roomId);
    }, 30_000);
    hostReconnectTimers.set(socket.id, timer);
  });
});

httpServer.listen(PORT, () => {
  console.log(`\n🎬  Сервер запущено на порту ${PORT}\n`);
});

module.exports = { app, io };
