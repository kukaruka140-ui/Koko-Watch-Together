// SyncController.js — синхронізація + нарахування балів за перегляд

const pointsTimers = new Map(); // roomId → intervalId

function registerSyncHandlers(socket, io, roomManager) {

  socket.on('playback_action', ({ roomId, action, currentTime }) => {
    const room = roomManager.getRoom(roomId);
    if (!room) return;

    if (!room.isHost(socket.id)) {
      socket.to(room.hostSocketId).emit('playback_request', {
        userId: socket.id, action, currentTime
      });
      return;
    }

    let isPlaying = room.playback.isPlaying;
    if (action === 'play')  isPlaying = true;
    if (action === 'pause') isPlaying = false;

    room.setPlayback({ isPlaying, currentTime });
    console.log(`[Sync] ${action} @ ${currentTime.toFixed(2)}s | ${roomId}`);

    // FIX: відправляємо тільки гостю (socket.to = всі крім відправника).
    // Echo хосту викликало drift через compensateLatency.
    socket.to(roomId).emit('playback_sync', {
      action, currentTime, isPlaying, serverTime: Date.now()
    });

    // Нарахування балів: запускаємо/зупиняємо таймер при play/pause
    if (action === 'play')  startPointsTimer(roomId, room, io);
    if (action === 'pause') stopPointsTimer(roomId);
  });

  socket.on('ping', ({ clientTime }) => {
    socket.emit('pong', { clientTime, serverTime: Date.now() });
  });

  socket.on('request_sync', ({ roomId }, callback) => {
    const room = roomManager.getRoom(roomId);
    if (!room) return callback?.({ error: 'Кімнату не знайдено' });
    callback?.({ state: room.toClientState() });
  });
}

// ── Бали за перегляд ─────────────────────────────────────────
// Кожні 60с поки відео грає — хост і гість отримують +1 бал.
// Бали зберігаються в room.points[socketId] (в пам'яті).
// В майбутньому замінити на запис у БД.

function startPointsTimer(roomId, room, io) {
  if (pointsTimers.has(roomId)) return; // вже запущено

  const timer = setInterval(() => {
    const r = room; // room може змінитись — беремо актуальний
    if (!r || !r.playback.isPlaying) {
      stopPointsTimer(roomId);
      return;
    }

    // Ініціалізуємо якщо немає
    if (!r.points) r.points = {};

    let updated = [];

    if (r.hostSocketId) {
      r.points[r.hostSocketId] = (r.points[r.hostSocketId] || 0) + 1;
      updated.push({ role: 'host', name: r.hostName, points: r.points[r.hostSocketId] });
    }
    if (r.guestSocketId) {
      r.points[r.guestSocketId] = (r.points[r.guestSocketId] || 0) + 1;
      updated.push({ role: 'guest', name: r.guestName, points: r.points[r.guestSocketId] });
    }

    console.log(`[Points] ${roomId}:`, updated.map(u => `${u.name}=${u.points}`).join(', '));

    // Надсилаємо оновлення балів всім у кімнаті
    io.to(roomId).emit('points_update', { scores: updated });

  }, 60_000); // кожні 60 секунд

  pointsTimers.set(roomId, timer);
}

function stopPointsTimer(roomId) {
  const t = pointsTimers.get(roomId);
  if (t) { clearInterval(t); pointsTimers.delete(roomId); }
}

// Зовнішній виклик при закритті кімнати
function clearRoomPointsTimer(roomId) {
  stopPointsTimer(roomId);
}

module.exports = { registerSyncHandlers, clearRoomPointsTimer };
