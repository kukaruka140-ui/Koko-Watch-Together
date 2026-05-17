// ============================================================
//  driveProxy.js — HTTP-прокси для Google Drive видео-стримов
//
//  Зачем нужен:
//  1. Google Drive CORS блокирует запросы из Telegram WebView
//  2. Нужна поддержка HTTP Range для перемотки (206 Partial Content)
//  3. Авторизация через API-ключ прячется на сервере
// ============================================================

const express = require('express');
const https   = require('https');
const router  = express.Router();

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';

/**
 * GET /api/stream?fileId=FILE_ID
 *
 * Проксирует видео-файл с Google Drive с поддержкой Range-запросов.
 * Файл должен быть публично доступен ("Anyone with the link" → Viewer).
 *
 * Пример использования в плеере:
 *   src = `${BACKEND_URL}/api/stream?fileId=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs`
 */
router.get('/stream', (req, res) => {
  const { fileId } = req.query;

  if (!fileId || !/^[-\w]{10,}$/.test(fileId)) {
    return res.status(400).json({ error: 'Некорректный fileId' });
  }

  // Формируем URL к Google Drive API
  const apiUrl = GOOGLE_API_KEY
    ? `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${GOOGLE_API_KEY}`
    : `https://drive.google.com/uc?export=download&id=${fileId}`;

  // Пробрасываем Range-заголовок (критично для перемотки видео)
  const proxyHeaders = {
    'User-Agent': 'Mozilla/5.0'
  };
  if (req.headers.range) {
    proxyHeaders['Range'] = req.headers.range;
  }

  const proxyReq = https.request(apiUrl, { headers: proxyHeaders }, (proxyRes) => {
    // CORS для Telegram WebView
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
    res.setHeader('Accept-Ranges', 'bytes');

    // Прокидываем статус Google (200 или 206 Partial Content)
    res.status(proxyRes.statusCode);

    // Прокидываем нужные заголовки ответа
    const passthrough = [
      'content-type',
      'content-length',
      'content-range',
      'last-modified',
      'etag',
      'cache-control'
    ];
    passthrough.forEach(header => {
      if (proxyRes.headers[header]) {
        res.setHeader(header, proxyRes.headers[header]);
      }
    });

    // Стримим тело ответа напрямую клиенту (без буферизации в памяти)
    proxyRes.pipe(res);

    proxyRes.on('error', (err) => {
      console.error('[DriveProxy] Ошибка стрима:', err.message);
    });
  });

  proxyReq.on('error', (err) => {
    console.error('[DriveProxy] Ошибка запроса к Google:', err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: 'Ошибка проксирования видео' });
    }
  });

  // Таймаут 10с на подключение к Google
  proxyReq.setTimeout(10000, () => {
    proxyReq.destroy();
    if (!res.headersSent) {
      res.status(504).json({ error: 'Таймаут подключения к Google Drive' });
    }
  });

  proxyReq.end();
});

// OPTIONS preflight для CORS
router.options('/stream', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.status(204).end();
});

module.exports = router;
