// ============================================================
//  ChatController.js — Обработчики чата, реплаев и реакций
// ============================================================

const { nanoid } = require('nanoid');

// Разрешённые эмодзи для реакций (whitelist)
const ALLOWED_EMOJIS = ['❤️', '😂', '🔥', '👏', '😮', '😢', '🎉', '💯', '🤩', '😍'];

/**
 * Регистрирует обработчики чата на сокете.
 *
 * @param {Socket}      socket
 * @param {Server}      io
 * @param {RoomManager} roomManager
 */
function registerChatHandlers(socket, io, roomManager) {

  // ── Отправка сообщения ─────────────────────────────────────
  // Payload: { roomId, text, replyTo: null | { id, text, userName } }
  socket.on('send_message', ({ roomId, text, replyTo = null }) => {
    const room = roomManager.getRoom(roomId);
    if (!room) return;

    const trimmed = (text || '').trim();
    // Проверки: не пусто, не длиннее 500 символов
    if (!trimmed || trimmed.length > 500) return;

    const isHost = room.isHost(socket.id);
    const userName = isHost ? room.hostName : room.guestName;
    const role = isHost ? 'host' : 'guest';

    const message = {
      id:        nanoid(10),        // уникальный ID сообщения
      userId:    socket.id,
      userName,
      role,
      text:      trimmed,
      replyTo,                     // объект { id, text, userName } или null
      timestamp: Date.now()
    };

    // Сохраняем в истории комнаты (последние 200 сообщений)
    room.messages.push(message);
    if (room.messages.length > 200) {
      room.messages.shift();
    }

    console.log(`[Chat] ${userName} (${role}): "${trimmed.substring(0, 40)}..." → ${roomId}`);

    // Рассылаем всем участникам комнаты
    io.to(roomId).emit('new_message', message);
  });

  // ── Плавающая реакция (эмодзи) ────────────────────────────
  // Payload: { roomId, emoji }
  // Реакция отображается у ОБОИХ пользователей с анимацией.
  socket.on('send_reaction', ({ roomId, emoji }) => {
    const room = roomManager.getRoom(roomId);
    if (!room) return;

    // Блокируем всё, кроме разрешённого списка
    if (!ALLOWED_EMOJIS.includes(emoji)) return;

    const isHost = room.isHost(socket.id);
    const role = isHost ? 'host' : 'guest';

    io.to(roomId).emit('new_reaction', {
      emoji,
      userId:  socket.id,
      role,
      // Случайная X-позиция (0..1) — клиент умножает на ширину экрана.
      // Это создаёт эффект "разброса" реакций по экрану.
      spawnX: Math.random(),
      id: nanoid(6) // уникальный ID для React key
    });
  });
}

module.exports = { registerChatHandlers };
