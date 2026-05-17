// ============================================================
//  SyncController.js — Логика синхронизации воспроизведения
//  Вынесена из server.js для чистоты архитектуры
// ============================================================

/**
 * Регистрирует все обработчики синхронизации на сокете хоста/гостя.
 *
 * @param {Socket}      socket      — текущий сокет
 * @param {Server}      io          — инстанс Socket.io
 * @param {RoomManager} roomManager — менеджер комнат
 */
function registerSyncHandlers(socket, io, roomManager) {

  // ── play / pause / seek ──────────────────────────────────
  // Только хост может инициировать действие.
  // Гость отправляет запрос → хост получает → рассылает всем.
  socket.on('playback_action', ({ roomId, action, currentTime }) => {
    const room = roomManager.getRoom(roomId);
    if (!room) return;

    if (!room.isHost(socket.id)) {
      // Гость попросил — пересылаем запрос хосту
      socket.to(room.hostSocketId).emit('playback_request', {
        userId: socket.id,
        action,
        currentTime
      });
      return;
    }

    // Хост инициирует → обновляем серверное состояние
    let isPlaying = room.playback.isPlaying;
    if (action === 'play')  isPlaying = true;
    if (action === 'pause') isPlaying = false;
    // seek: isPlaying не меняется, только currentTime

    room.setPlayback({ isPlaying, currentTime });

    console.log(`[Sync] ${action} @ ${currentTime.toFixed(2)}s | комната ${roomId}`);

    // Рассылаем всем в комнате (включая хоста для синхронизации его UI)
    // serverTime нужен клиенту для компенсации сетевой задержки:
    //   compensatedTime = currentTime + (Date.now() - serverTime) / 1000
    io.to(roomId).emit('playback_sync', {
      action,
      currentTime,
      isPlaying,
      serverTime: Date.now()
    });
  });

  // ── Ping-Pong для замера RTT ──────────────────────────────
  // Клиент шлёт ping каждые 5с.
  // RTT = Date.now() - clientTime (считается на клиенте после pong).
  // Клиент хранит latencyOffset = RTT / 2 и использует при seek-компенсации.
  socket.on('ping', ({ clientTime }) => {
    socket.emit('pong', {
      clientTime,       // возвращаем обратно для расчёта RTT на клиенте
      serverTime: Date.now()
    });
  });

  // ── Запрос актуального состояния (reconnect) ─────────────
  socket.on('request_sync', ({ roomId }, callback) => {
    const room = roomManager.getRoom(roomId);
    if (!room) {
      callback?.({ error: 'Комната не найдена' });
      return;
    }
    callback?.({ state: room.toClientState() });
  });
}

module.exports = { registerSyncHandlers };
