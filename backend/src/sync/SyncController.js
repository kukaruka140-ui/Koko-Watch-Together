// ============================================================
//  SyncController.js — Логика синхронизации воспроизведения
// ============================================================

function registerSyncHandlers(socket, io, roomManager) {

  socket.on('playback_action', ({ roomId, action, currentTime }) => {
    const room = roomManager.getRoom(roomId);
    if (!room) return;

    if (!room.isHost(socket.id)) {
      // Гість → пересилаємо запит хосту
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

    // FIX БАГ 3: відправляємо playback_sync ТІЛЬКИ гостю (socket.to = всі крім хоста).
    // Хост вже перемотав відео сам — якщо надіслати йому echo, він отримає
    // compensateLatency(currentTime + networkDelay) і перестрибне на трохи іншу позицію.
    // Це і було причиною відставання хоста від гостя.
    socket.to(roomId).emit('playback_sync', {
      action,
      currentTime,
      isPlaying,
      serverTime: Date.now()
    });
  });

  socket.on('ping', ({ clientTime }) => {
    socket.emit('pong', { clientTime, serverTime: Date.now() });
  });

  socket.on('request_sync', ({ roomId }, callback) => {
    const room = roomManager.getRoom(roomId);
    if (!room) return callback?.({ error: 'Комната не найдена' });
    callback?.({ state: room.toClientState() });
  });
}

module.exports = { registerSyncHandlers };
