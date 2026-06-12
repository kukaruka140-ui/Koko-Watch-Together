require('dotenv').config();

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');

const roomManager  = require('./rooms/RoomManager');
const driveProxy   = require('./proxy/driveProxy');
const { registerSyncHandlers } = require('./sync/SyncController');
const { registerChatHandlers } = require('./chat/ChatController');
const { socketAuthMiddleware } = require('./middleware/authMiddleware');

const PORT = process.env.PORT || 3001;

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || '*', methods: ['GET', 'OPTIONS', 'POST'] }));
app.use(express.json());
app.use('/api', driveProxy);

app.get('/health', (_, res) => {
  res.json({ ok: true, rooms: roomManager.rooms.size, uptime: process.uptime() });
});

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.FRONTEND_URL || '*', methods: ['GET', 'POST'] },
  pingTimeout:  15000,
  pingInterval: 5000
});

io.use(socketAuthMiddleware);

// Таймери реконнекту тільки для хоста (хост = власник кімнати)
// Гість скидається одразу при disconnect — слот вільниться миттєво
const hostReconnectTimers = new Map(); // socketId → timerId

function clearHostTimer(socketId) {
  const t = hostReconnectTimers.get(socketId);
  if (t) { clearTimeout(t); hostReconnectTimers.delete(socketId); }
}

io.on('connection', (socket) => {
  const user = socket.telegramUser;
  console.log(`[Socket.io] ✅ ${socket.id} (${user?.first_name || 'anon'})`);

  // ── Створення кімнати (Хост) ─────────────────────────────
  socket.on('create_room', ({ videoUrl, userName }, callback) => {
    try {
      if (!videoUrl || typeof videoUrl !== 'string') {
        return callback({ error: 'videoUrl обязателен' });
      }
      const room = roomManager.createRoom(socket.id, videoUrl.trim());
      room.hostName = userName || user?.first_name || 'Host';
      socket.join(room.roomId);
      console.log(`[create_room] ${room.hostName} → ${room.roomId}`);
      callback({ ok: true, roomId: room.roomId, role: 'host', state: room.toClientState() });
    } catch (err) {
      console.error('[create_room]', err);
      callback({ error: 'Не удалось создать комнату' });
    }
  });

  // ── Вхід в кімнату (Гість) ──────────────────────────────
  socket.on('join_room', ({ roomId, userName }, callback) => {
    try {
      if (!roomId) return callback({ error: 'roomId обязателен' });
      const room = roomManager.getRoom(roomId.toUpperCase());
      if (!room) return callback({ error: 'Комната не найдена. Проверьте код.' });

      // FIX БАГ 2: гість може зайти якщо:
      // - слот вільний (guestSocketId === null)
      // - або це той самий сокет (рідко)
      // - або кімната "повна" але старий гостьовий сокет вже не підключений
      //   (disconnect вже скинув guestSocketId на null — дивись нижче)
      // Більше НЕ блокуємо по isFull() без перевірки живості сокету
      if (room.guestSocketId !== null && room.guestSocketId !== socket.id) {
        // Перевіряємо чи старий гостьовий сокет ще реально підключений
        const oldGuestSocket = io.sockets.sockets.get(room.guestSocketId);
        if (oldGuestSocket && oldGuestSocket.connected) {
          return callback({ error: 'В комнате уже два участника' });
        }
        // Старий сокет мертвий — звільняємо слот
        room.guestSocketId = null;
      }

      room.guestSocketId = socket.id;
      room.guestName     = userName || user?.first_name || 'Guest';
      socket.join(roomId.toUpperCase());
      console.log(`[join_room] ${room.guestName} → ${room.roomId}`);

      socket.to(room.roomId).emit('user_joined', {
        userId: socket.id, userName: room.guestName
      });

      // FIX БАГ 1: toClientState() вже повертає getCurrentTime() з урахуванням
      // elapsed — гість отримує актуальну позицію, а не 0
      callback({ ok: true, role: 'guest', state: room.toClientState(), hostName: room.hostName });
    } catch (err) {
      console.error('[join_room]', err);
      callback({ error: 'Не удалось войти в комнату' });
    }
  });

  registerSyncHandlers(socket, io, roomManager);
  registerChatHandlers(socket, io, roomManager);

  // ── Disconnect ───────────────────────────────────────────
  socket.on('disconnect', (reason) => {
    console.log(`[Socket.io] ❌ ${socket.id} | ${reason}`);

    const room = roomManager.findRoomBySocket(socket.id);
    if (!room) return;

    const isHost   = room.isHost(socket.id);
    const uName    = isHost ? room.hostName : room.guestName;
    const roomId   = room.roomId;

    socket.to(roomId).emit('user_disconnected', {
      userId: socket.id, userName: uName,
      role: isHost ? 'host' : 'guest', willReconnect: isHost
    });

    if (!isHost) {
      // FIX БАГ 2: гість — одразу скидаємо слот.
      // Немає сенсу тримати 30с — гість може зайти знову в будь-який момент.
      room.guestSocketId = null;
      console.log(`[disconnect] Гость ${uName} вышел, слот освобождён`);
      io.to(roomId).emit('user_left', { userId: socket.id, userName: uName });
      return;
    }

    // Хост — даємо 30с на реконнект перед закриттям кімнати
    clearHostTimer(socket.id);
    const timer = setTimeout(() => {
      hostReconnectTimers.delete(socket.id);
      const cur = roomManager.getRoom(roomId);
      if (!cur) return;
      if (cur.hostSocketId !== socket.id) return; // вже реконнектився
      console.log(`[disconnect] Хост ${uName} не вернулся, закрываем ${roomId}`);
      io.to(roomId).emit('room_closed', { reason: 'host_left', message: `${uName} покинул комнату` });
      roomManager.deleteRoom(roomId);
    }, 30_000);
    hostReconnectTimers.set(socket.id, timer);
  });
});

httpServer.listen(PORT, () => {
  console.log(`\n🎬  RAVE сервер запущен на порту ${PORT}\n`);
});

module.exports = { app, io };
