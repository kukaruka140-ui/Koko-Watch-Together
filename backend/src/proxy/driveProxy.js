const express = require('express');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const router = express.Router();

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';

// Универсальный запрос с поддержкой редиректов
function makeRequest(urlStr, headers, callback, redirectCount = 0) {
  if (redirectCount > 6) {
    callback(new Error('Too many redirects'), null, null);
    return;
  }

  let parsedUrl;
  try { parsedUrl = new URL(urlStr); } 
  catch (e) { callback(e, null, null); return; }

  const lib = parsedUrl.protocol === 'https:' ? https : http;

  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
    path: parsedUrl.pathname + parsedUrl.search,
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0',
      'Accept': '*/*',
      'Accept-Encoding': 'identity',
      ...headers
    }
  };

  const req = lib.request(options, (res) => {
    // Редирект
    if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
      res.resume();
      const nextUrl = res.headers.location.startsWith('http') 
        ? res.headers.location 
        : `${parsedUrl.protocol}//${parsedUrl.host}${res.headers.location}`;
      makeRequest(nextUrl, headers, callback, redirectCount + 1);
      return;
    }
    callback(null, res, res.statusCode);
  });

  req.on('error', (e) => callback(e, null, null));
  req.setTimeout(20000, () => { req.destroy(); callback(new Error('Timeout'), null, null); });
  req.end();
}

router.get('/stream', (req, res) => {
  const { fileId } = req.query;
  if (!fileId || !/^[\w-]{10,}$/.test(fileId)) {
    return res.status(400).json({ error: 'Некорректный fileId' });
  }

  // Заголовки от клиента (Range для перемотки)
  const forwardHeaders = {};
  if (req.headers.range) {
    forwardHeaders['Range'] = req.headers.range;
  }

  // URL к Google Drive API
  const apiUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${GOOGLE_API_KEY}`;

  console.log(`[DriveProxy] fileId=${fileId} range=${req.headers.range || 'none'}`);

  makeRequest(apiUrl, forwardHeaders, (err, proxyRes, statusCode) => {
    if (err) {
      console.error('[DriveProxy] Ошибка:', err.message);
      if (!res.headersSent) res.status(502).json({ error: err.message });
      return;
    }

    const contentType = proxyRes.headers['content-type'] || '';

    // Google вернул HTML (страница подтверждения или ошибка)
    if (contentType.includes('text/html')) {
      let body = '';
      proxyRes.on('data', d => body += d);
      proxyRes.on('end', () => {
        console.error('[DriveProxy] Google вернул HTML:', body.substring(0, 200));
        if (!res.headersSent) {
          res.status(403).json({ 
            error: 'Файл не публичный или требует подтверждения Google',
            hint: 'Открой доступ: Все у кого есть ссылка → Viewer'
          });
        }
      });
      return;
    }

    // CORS заголовки — обязательно для iOS WebView
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges, Content-Type');

    // Критично для iOS — принимает только video/mp4
    const fixedContentType = contentType.includes('video') 
      ? contentType 
      : 'video/mp4';
    res.setHeader('Content-Type', fixedContentType);
    res.setHeader('Accept-Ranges', 'bytes');

    // Пробрасываем заголовки
    const pass = ['content-length', 'content-range', 'last-modified', 'etag'];
    pass.forEach(h => {
      if (proxyRes.headers[h]) res.setHeader(h, proxyRes.headers[h]);
    });

    // Статус (200 или 206 Partial Content)
    res.status(statusCode);

    // Стрим
    proxyRes.pipe(res);
    proxyRes.on('error', e => console.error('[DriveProxy] Stream error:', e.message));
    req.on('close', () => proxyRes.destroy());
  });
});

// OPTIONS preflight
router.options('/stream', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');
  res.status(204).end();
});

module.exports = router;