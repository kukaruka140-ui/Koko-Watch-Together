// ============================================================
//  socket.js — Socket.io клиент (синглтон)
//
//  Один инстанс на всё приложение.
//  Подключается лениво (при первом вызове getSocket()).
// ============================================================

import { io } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

let socketInstance = null;

/**
 * Возвращает или создаёт единственный инстанс Socket.io клиента.
 * @param {string} initData — Telegram WebApp initData для авторизации
 */
export function getSocket(initData = '') {
  if (socketInstance) return socketInstance;

  socketInstance = io(BACKEND_URL, {
    // Передаём initData для серверной валидации
    auth: { initData },
    // Автопереподключение: до 5 попыток с нарастающей задержкой
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    // Используем WebSocket как основной транспорт
    transports: ['websocket'],
    // Таймаут подключения
    timeout: 10000
  });

  socketInstance.on('connect', () => {
    console.log('[Socket] ✅ Подключён:', socketInstance.id);
  });

  socketInstance.on('disconnect', (reason) => {
    console.log('[Socket] ❌ Отключён:', reason);
  });

  socketInstance.on('connect_error', (err) => {
    console.error('[Socket] Ошибка подключения:', err.message);
  });

  return socketInstance;
}

/**
 * Уничтожает соединение (вызывать при выходе из комнаты).
 */
export function destroySocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}

export default getSocket;
