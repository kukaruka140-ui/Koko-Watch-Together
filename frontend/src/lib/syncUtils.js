// ============================================================
//  syncUtils.js — Утилиты для компенсации задержки сети
// ============================================================

/**
 * Хранит последние N замеров RTT для сглаживания.
 */
const RTT_SAMPLES = 5;
const rttHistory = [];

/**
 * Обновляет историю RTT и возвращает текущее среднее.
 * Вызывается при получении pong от сервера.
 *
 * @param {number} clientTime — время отправки ping (мс)
 * @returns {number} средний RTT в мс
 */
export function updateRTT(clientTime) {
  const rtt = Date.now() - clientTime;
  rttHistory.push(rtt);
  if (rttHistory.length > RTT_SAMPLES) {
    rttHistory.shift();
  }
  return getAverageRTT();
}

/**
 * Возвращает среднее RTT по последним замерам.
 */
export function getAverageRTT() {
  if (rttHistory.length === 0) return 0;
  return rttHistory.reduce((a, b) => a + b, 0) / rttHistory.length;
}

/**
 * Вычисляет скорректированную позицию воспроизведения.
 *
 * Логика:
 * 1. Сервер шлёт { currentTime, serverTime } — позицию и серверное время
 * 2. Мы получили пакет через ~RTT/2 после его отправки
 * 3. Значит видео уже ушло вперёд на RTT/2 секунды
 * 4. Дополнительно если видео играет — добавляем время обработки события
 *
 * @param {number} currentTime — позиция от сервера (с)
 * @param {number} serverTime  — серверное время отправки (мс)
 * @param {boolean} isPlaying  — играет ли видео
 * @returns {number} скорректированная позиция (с)
 */
export function compensateLatency(currentTime, serverTime, isPlaying) {
  if (!isPlaying) return currentTime;

  // Время, прошедшее с момента отправки события сервером
  const networkDelay = (Date.now() - serverTime) / 1000; // в секундах

  return currentTime + networkDelay;
}

/**
 * Определяет, нужно ли принудительно делать seek.
 * Мягкий порог: до 2с — плеер сам догонит.
 * Жёсткий порог: более 2с — принудительный seek.
 *
 * @param {number} playerTime  — текущая позиция плеера
 * @param {number} targetTime  — целевая позиция (от сервера с компенсацией)
 * @returns {'none' | 'soft' | 'hard'}
 */
export function getDriftAction(playerTime, targetTime) {
  const drift = Math.abs(playerTime - targetTime);
  if (drift < 0.5)  return 'none'; // расхождение < 0.5с — игнорируем
  if (drift < 2.0)  return 'soft'; // 0.5–2с — мягкая корректировка (playbackRate)
  return 'hard';                    // > 2с — жёсткий seek
}

/**
 * Форматирует секунды в MM:SS или HH:MM:SS
 */
export function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}
