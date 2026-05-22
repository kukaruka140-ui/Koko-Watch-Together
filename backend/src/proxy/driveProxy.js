// Исправленный driveProxy с обходом Google confirmation page
const express = require('express');
const https   = require('https');
const router  = express.Router();

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';

function fetchWithRedirects(url, headers, res, redirectCount = 0) {
  if (redirectCount > 5) {
    if (!res.headersSent) res.status(502).json({ error: 'Слишком много редиректов' });
    return;
  }

  const urlObj = new URL(url);
  const options = {
    hostname: urlObj.hostname,
    path: urlObj.pathname + urlObj.search,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      ...headers
    }
  };

  const proxyReq = https.request(options, (proxyRes) => {
    if ([301, 302, 303, 307, 308].includes(proxyRes.statusCode)) {
      const location = proxyRes.headers['location'];
      if (location) {
        proxyRes.resume();
        return fetchWithRedirects(location, headers, res, redirectCount + 1);
      }
    }

    const contentType = proxyRes.headers['content-type'] || '';
    if (contentType.includes('text/html')) {
      proxyRes.resume();
      if (!res.headersSent) {
        res.status(403).json({ 
          error: 'Google Drive требует подтверждения. Файл не публичный или слишком большой.'
        });
      }
      return;
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
    res.setHeader('Accept-Ranges', 'bytes');
    res.status(proxyRes.statusCode);

    const passthrough = ['content-type','content-length','content-range','last-modified','etag','cache-control'];
    passthrough.forEach(h => {
      if (proxyRes.headers[h]) res.setHeader(h, proxyRes.headers[h]);
    });

    proxyRes.pipe(res);
  });

  proxyReq.on('error', err => {
    if (!res.headersSent) res.status(502).json({ error: 'Ошибка запроса к Google' });
  });

  proxyReq.setTimeout(15000, () => {
    proxyReq.destroy();
    if (!res.headersSent) res.status(504).json({ error: 'Таймаут' });
  });

  proxyReq.end();
}

router.get('/stream', (req, res) => {
  const { fileId } = req.query;
  if (!fileId) return res.status(400).json({ error: 'fileId обязателен' });

  const rangeHeader = req.headers.range ? { 'Range': req.headers.range } : {};

  const url = GOOGLE_API_KEY
    ? `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${GOOGLE_API_KEY}`
    : `https://drive.google.com/uc?export=download&confirm=t&id=${fileId}`;

  fetchWithRedirects(url, rangeHeader, res);
});

router.options('/stream', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.status(204).end();
});

module.exports = router;