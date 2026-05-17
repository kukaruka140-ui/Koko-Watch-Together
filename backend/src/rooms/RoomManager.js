// ============================================================
//  RoomManager.js — Синглтон-менеджер всех активных комнат
//  Dev: Map в памяти | Prod: заменяется на Redis-адаптер
// ============================================================

const Room = require('./Room');
const { nanoid } = require('nanoid');

class RoomManager {
  constructor() {
    // roomId → Room instance
    this.rooms = new Map();

    // Автоочистка каждые 30 минут: удаляем комнаты старше 6 часов
    setInterval(() => this._cleanup(), 30 * 60 * 1000);
  }

  /**
   * Создаёт новую комнату и возвращает её инстанс.
   * roomId — 8 символов, только заглавные буквы и цифры (удобно для набора вручную)
   */
  createRoom(hostSocketId, videoUrl) {
    const roomId = nanoid(8).toUpperCase();
    const room = new Room(roomId, hostSocketId, videoUrl);
    this.rooms.set(roomId, room);
    console.log(`[RoomManager] ✅ Создана комната ${roomId} | host: ${hostSocketId}`);
    return room;
  }

  /**
   * Возвращает комнату по ID или null.
   */
  getRoom(roomId) {
    return this.rooms.get(roomId) || null;
  }

  /**
   * Удаляет комнату (при закрытии или TTL).
   */
  deleteRoom(roomId) {
    this.rooms.delete(roomId);
    console.log(`[RoomManager] 🗑️  Удалена комната ${roomId}`);
  }

  /**
   * Находит комнату, где данный сокет является хостом или гостем.
   * Используется при disconnect.
   */
  findRoomBySocket(socketId) {
    for (const room of this.rooms.values()) {
      if (room.hostSocketId === socketId || room.guestSocketId === socketId) {
        return room;
      }
    }
    return null;
  }

  /**
   * TTL-очистка: удаляем комнаты старше 6 часов.
   */
  _cleanup() {
    const TTL = 6 * 60 * 60 * 1000; // 6 часов в мс
    const now = Date.now();
    let cleaned = 0;
    for (const [roomId, room] of this.rooms) {
      if (now - room.createdAt > TTL) {
        this.deleteRoom(roomId);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`[RoomManager] 🧹 TTL-очистка: удалено ${cleaned} комнат`);
    }
  }
}

// Экспортируем синглтон — один менеджер на весь процесс
module.exports = new RoomManager();
