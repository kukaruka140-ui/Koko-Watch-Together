// ============================================================
//  Room.js — Модель одной комнаты
//  Хранит состояние воспроизведения, участников и историю чата
// ============================================================

class Room {
  constructor(roomId, hostSocketId, videoUrl) {
    this.roomId = roomId;
    this.hostSocketId = hostSocketId;
    this.guestSocketId = null;
    this.hostName = 'Host';
    this.guestName = 'Guest';

    // URL видео (Google Drive fileId или прямая ссылка)
    this.videoUrl = videoUrl;

    // ─── Состояние воспроизведения ───────────────────────────
    this.playback = {
      isPlaying: false,
      currentTime: 0,       // текущая позиция в секундах
      lastUpdateAt: Date.now() // серверное время последнего обновления
    };

    // ─── История чата (хранится в памяти) ───────────────────
    this.messages = [];

    // ─── Метаданные ──────────────────────────────────────────
    this.createdAt = Date.now();
  }

  /**
   * Вычисляет актуальную позицию с учётом прошедшего времени.
   * Если видео играет — позиция «дрейфует» вперёд.
   */
  getCurrentTime() {
    if (!this.playback.isPlaying) {
      return this.playback.currentTime;
    }
    const elapsed = (Date.now() - this.playback.lastUpdateAt) / 1000;
    return this.playback.currentTime + elapsed;
  }

  /**
   * Обновляет состояние воспроизведения.
   * Вызывается при play / pause / seek от хоста.
   */
  setPlayback({ isPlaying, currentTime }) {
    this.playback.isPlaying = isPlaying;
    this.playback.currentTime = currentTime;
    this.playback.lastUpdateAt = Date.now();
  }

  // Проверяет роль сокета
  isHost(socketId) {
    return this.hostSocketId === socketId;
  }

  // Комната считается заполненной, если есть гость
  isFull() {
    return this.guestSocketId !== null;
  }

  /**
   * Сериализация для отправки клиенту при join / request_sync.
   * currentTime уже учитывает дрейф — клиент получает актуальную позицию.
   */
  toClientState() {
    return {
      roomId: this.roomId,
      videoUrl: this.videoUrl,
      hostName: this.hostName,
      guestName: this.guestName,
      playback: {
        isPlaying: this.playback.isPlaying,
        currentTime: this.getCurrentTime(),
        serverTime: Date.now()
      },
      messages: this.messages.slice(-50) // последние 50 сообщений
    };
  }
}

module.exports = Room;
