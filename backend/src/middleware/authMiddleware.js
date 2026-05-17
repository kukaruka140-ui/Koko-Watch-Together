// middleware/authMiddleware.js
const crypto = require('crypto');

function validateTelegramInitData(initData, botToken) {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return false;

    params.delete('hash');
    const checkString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(checkString)
      .digest('hex');

    return expectedHash === hash;
  } catch {
    return false;
  }
}

function socketAuthMiddleware(socket, next) {
  // ✅ В режиме разработки или SKIP_AUTH=true — пропускаем проверку
  if (process.env.SKIP_AUTH === 'true' || process.env.NODE_ENV !== 'production') {
    socket.telegramUser = { id: 0, first_name: 'Browser User' };
    return next();
  }

  const initData = socket.handshake.auth?.initData || 
                   socket.handshake.query?.initData;

  if (!initData) {
    return next(new Error('Unauthorized: no initData'));
  }

  const botToken = process.env.BOT_TOKEN;
  if (!botToken) {
    // Если BOT_TOKEN не задан — пропускаем (misconfiguration, не блокируем)
    socket.telegramUser = { id: 0, first_name: 'Unknown' };
    return next();
  }

  if (!validateTelegramInitData(initData, botToken)) {
    return next(new Error('Unauthorized: invalid Telegram initData'));
  }

  // Парсим user из initData
  try {
    const params = new URLSearchParams(initData);
    socket.telegramUser = JSON.parse(params.get('user') || '{}');
  } catch {
    socket.telegramUser = { id: 0, first_name: 'User' };
  }

  next();
}

module.exports = { socketAuthMiddleware };