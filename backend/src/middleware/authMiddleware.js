// ============================================================
//  authMiddleware.js — Валидация Telegram initData
//
//  Telegram подписывает initData HMAC-SHA256 ключом бота.
//  Мы проверяем подпись на сервере, чтобы убедиться,
//  что запрос действительно пришёл из Telegram.
//
//  Документация: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
// ============================================================

const crypto = require('crypto');

const BOT_TOKEN = process.env.BOT_TOKEN || '';

/**
 * Валидирует строку initData от Telegram WebApp.
 * Возвращает распарсенные данные пользователя или null при неудаче.
 *
 * @param {string} initData — строка из window.Telegram.WebApp.initData
 * @returns {{ user, auth_date, hash, ... } | null}
 */
function validateInitData(initData) {
  if (!initData || !BOT_TOKEN) return null;

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');

    // Формируем строку для проверки подписи
    const checkString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    // Секретный ключ = HMAC-SHA256(BOT_TOKEN, "WebAppData")
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(BOT_TOKEN)
      .digest();

    // Вычисляем ожидаемый hash
    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(checkString)
      .digest('hex');

    if (expectedHash !== hash) return null;

    // Проверяем свежесть данных (не старше 1 часа)
    const authDate = parseInt(params.get('auth_date') || '0', 10);
    if (Date.now() / 1000 - authDate > 3600) return null;

    // Возвращаем распарсенные данные
    const userData = params.get('user');
    return {
      ...Object.fromEntries(params),
      user: userData ? JSON.parse(userData) : null
    };
  } catch {
    return null;
  }
}

/**
 * Socket.io middleware для проверки initData при подключении.
 * Добавляет socket.telegramUser при успешной валидации.
 *
 * В dev-режиме (BOT_TOKEN не задан) — пропускает всех.
 */
function socketAuthMiddleware(socket, next) {
  // DEV-режим: пропускаем проверку
  if (!BOT_TOKEN) {
    socket.telegramUser = {
      id: socket.id,
      first_name: 'Dev User',
      username: 'devuser'
    };
    return next();
  }

  const initData = socket.handshake.auth?.initData;
  const validated = validateInitData(initData);

  if (!validated) {
    return next(new Error('Unauthorized: invalid Telegram initData'));
  }

  socket.telegramUser = validated.user;
  next();
}

module.exports = { socketAuthMiddleware, validateInitData };
