// ============================================================
//  server.js — Точка входа RAVE TMA Backend
//  Express + Socket.io + In-Memory Rooms
// ============================================================

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

// ─── Express ─────────────────────────────────────────────────
const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'OPTIONS', 'POST']
}));
app.use(express.json());

// Google Drive прокси-стриминг
app.use('/api', driveProxy);

// Health-check для мониторинга и деплоя
app.get('/health', (_, res) => {
  res.json({
    ok: true,
    rooms: roomManager.rooms.size,
    uptime: process.uptime()
  });
});

// ─── HTTP-сервер + Socket.io ──────────────────────────────────
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST']
  },
  pingTimeout:  15000,  // если клиент не отвечает 15с → дисконнект
  pingInterval: 5000    // пинг каждые 5с для поддержания соединения
});

// Telegram initData валидация на уровне подключения
io.use(socketAuthMiddleware);

// ─── Обработка подключений ────────────────────────────────────
io.on('connection', (socket) => {
  const user = socket.telegramUser;
  console.log(`[Socket.io] ✅ Подключился: ${socket.id} (${user?.first_name || 'anon'})`);

  // ── Создание комнаты (Хост) ──────────────────────────────
  // Payload:  { videoUrl: string, userName: string }
  // Callback: { ok, roomId, role, state } | { error }
  socket.on('create_room', ({ videoUrl, userName }, callback) => {
    try {
      if (!videoUrl || typeof videoUrl !== 'string') {
        return callback({ error: 'videoUrl обязателен' });
      }

      // Создаём комнату в менеджере
      const room = roomManager.createRoom(socket.id, videoUrl.trim());
      room.hostName = userName || user?.first_name || 'Host';

      // Подписываем сокет на Socket.io-комнату (для io.to(roomId))
      socket.join(room.roomId);

      console.log(`[create_room] ${room.hostName} создал комнату ${room.roomId}`);

      callback({
        ok: true,
        roomId: room.roomId,
        role: 'host',
        state: room.toClientState()
      });

    } catch (err) {
      console.error('[create_room] Ошибка:', err);
      callback({ error: 'Не удалось создать комнату' });
    }
  });

  // ── Вход в комнату (Гость) ───────────────────────────────
  // Payload:  { roomId: string, userName: string }
  // Callback: { ok, role, state, hostName } | { error }
  socket.on('join_room', ({ roomId, userName }, callback) => {
    try {
      if (!roomId) return callback({ error: 'roomId обязателен' });

      const room = roomManager.getRoom(roomId.toUpperCase());

      if (!room) {
        return callback({ error: 'Комната не найдена. Проверьте код.' });
      }

      // Если комната занята другим гостем (не текущим сокетом)
      if (room.isFull() && room.guestSocketId !== socket.id) {
        return callback({ error: 'В комнате уже два участника' });
      }

      // Регистрируем гостя (или обновляем socket.id при реконнекте)
      room.guestSocketId = socket.id;
      room.guestName = userName || user?.first_name || 'Guest';

      socket.join(roomId.toUpperCase());

      console.log(`[join_room] ${room.guestName} вошёл в комнату ${room.roomId}`);

      // Уведомляем хоста о входе гостя
      socket.to(room.roomId).emit('user_joined', {
        userId:   socket.id,
        userName: room.guestName
      });

      // Возвращаем гостю актуальное состояние с учётом дрейфа позиции
      callback({
        ok: true,
        role: 'guest',
        state: room.toClientState(),
        hostName: room.hostName
      });

    } catch (err) {
      console.error('[join_room] Ошибка:', err);
      callback({ error: 'Не удалось войти в комнату' });
    }
  });

  // Регистрируем обработчики синхронизации и чата
  registerSyncHandlers(socket, io, roomManager);
  registerChatHandlers(socket, io, roomManager);

  // ── Disconnect ───────────────────────────────────────────
  socket.on('disconnect', (reason) => {
    console.log(`[Socket.io] ❌ Отключился: ${socket.id} | причина: ${reason}`);

    const room = roomManager.findRoomBySocket(socket.id);
    if (!room) return;

    const isHost = room.isHost(socket.id);
    const userName = isHost ? room.hostName : room.guestName;

    // Уведомляем другого участника — показываем "пользователь пропал"
    socket.to(room.roomId).emit('user_disconnected', {
      userId:        socket.id,
      userName,
      role:          isHost ? 'host' : 'guest',
      willReconnect: true
    });

    // Даём 30 секунд на реконнект
    setTimeout(() => {
      const currentRoom = roomManager.getRoom(room.roomId);
      if (!currentRoom) return; // комната уже закрыта

      const stillGone = isHost
        ? currentRoom.hostSocketId === socket.id
        : currentRoom.guestSocketId === socket.id;

      if (!stillGone) return; // успешно переподключился

      console.log(`[disconnect] Таймаут реконнекта для ${socket.id} в ${room.roomId}`);

      if (isHost) {
        // Хост ушёл навсегда → закрываем комнату для всех
        io.to(room.roomId).emit('room_closed', {
          reason: 'host_left',
          message: `${userName} покинул комнату`
        });
        roomManager.deleteRoom(room.roomId);
      } else {
        // Гость ушёл → освобождаем слот, комната остаётся
        currentRoom.guestSocketId = null;
        io.to(room.roomId).emit('user_left', {
          userId: socket.id,
          userName
        });
      }
    }, 30_000); // 30 секунд грейс-период
  });
});

// ─── Запуск ───────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  🎬  RAVE TMA Server запущен              ║');
  console.log(`║  WS:    ws://localhost:${PORT}              ║`);
  console.log(`║  Proxy: http://localhost:${PORT}/api/stream ║`);
  console.log('╚══════════════════════════════════════════╝\n');
});

module.exports = { app, io };
