import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPreviewServer } from './server/ai-dialogue/src/server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const REMOTE_ASSET_BASE = 'https://iid7oom21.github.io/abdulrhman';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

// Create the AI Dialogue Preview server handler from server/ai-dialogue
const dialogueServer = createPreviewServer();

function delegateToDialogueServer(req, res, overrideUrl) {
  if (overrideUrl) {
    req.url = overrideUrl;
  }
  dialogueServer.emit('request', req, res);
}

async function proxyRemoteAsset(req, res, cleanPathname) {
  const remoteUrl = `${REMOTE_ASSET_BASE}${cleanPathname}`;
  try {
    const headers = {};
    if (req.headers.range) {
      headers.Range = req.headers.range;
    }
    const upstream = await fetch(remoteUrl, { headers });
    if (!upstream.ok && upstream.status !== 206) {
      res.writeHead(upstream.status, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Asset not found');
      return;
    }

    const ext = path.extname(cleanPathname).toLowerCase();
    const responseHeaders = {
      'Content-Type': upstream.headers.get('content-type') || MIME_TYPES[ext] || 'application/octet-stream',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600'
    };

    const contentLength = upstream.headers.get('content-length');
    if (contentLength) responseHeaders['Content-Length'] = contentLength;

    const contentRange = upstream.headers.get('content-range');
    if (contentRange) responseHeaders['Content-Range'] = contentRange;

    res.writeHead(upstream.status, responseHeaders);

    if (req.method === 'HEAD' || !upstream.body) {
      res.end();
      return;
    }

    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!res.writableEnded) {
        res.write(Buffer.from(value));
      }
    }
    if (!res.writableEnded) {
      res.end();
    }
  } catch {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    if (!res.writableEnded) {
      res.end('Upstream asset proxy error');
    }
  }
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // Support canonical /abdulrhman/... prefix transparently
  if (pathname === '/abdulrhman' || pathname === '/abdulrhman/') {
    pathname = '/';
  } else if (pathname.startsWith('/abdulrhman/')) {
    pathname = pathname.slice('/abdulrhman'.length);
  }

  // Healthcheck
  if (pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ status: 'ok', project: 'RAVEN' }));
    return;
  }

  // AI Dialogue Preview UI & API routes
  if (pathname === '/dialogue' || pathname === '/dialogue/' || pathname === '/dialogue/index.html') {
    delegateToDialogueServer(req, res, '/');
    return;
  }

  if (pathname.startsWith('/api/')) {
    delegateToDialogueServer(req, res, pathname + parsedUrl.search);
    return;
  }

  // Root redirect straight to /raven/#top so the preview opens directly on the user's RAVEN page
  if (pathname === '/' || pathname === '/index.html') {
    const query = parsedUrl.search || '';
    res.writeHead(302, { Location: `/raven/${query}#top` });
    res.end();
    return;
  }

  // Resolve local static file path safely inside __dirname
  let relativePath = pathname.replace(/^\/+/, '');
  let candidatePath = path.resolve(__dirname, relativePath);

  if (!candidatePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  // Directory index handling
  if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isDirectory()) {
    if (!pathname.endsWith('/')) {
      res.writeHead(302, { Location: `${pathname}/${parsedUrl.search}` });
      res.end();
      return;
    }
    candidatePath = path.join(candidatePath, 'index.html');
  }

  if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
    const ext = path.extname(candidatePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const stat = fs.statSync(candidatePath);

    // Handle Range requests for local media files
    const range = req.headers.range;
    if (range && (ext === '.mp3' || ext === '.mp4')) {
      const match = /bytes=(\d*)-(\d*)/.exec(range);
      if (match) {
        const start = match[1] ? parseInt(match[1], 10) : 0;
        const end = match[2] ? parseInt(match[2], 10) : stat.size - 1;
        if (start >= 0 && start <= end && end < stat.size) {
          res.writeHead(206, {
            'Content-Type': contentType,
            'Content-Range': `bytes ${start}-${end}/${stat.size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': end - start + 1
          });
          fs.createReadStream(candidatePath, { start, end }).pipe(res);
          return;
        }
      }
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stat.size,
      'Cache-Control': 'no-cache'
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(candidatePath).pipe(res);
    return;
  }

  // Fallback to streaming binary media assets from iid7oom21.github.io/abdulrhman
  if (
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/fourth-signature/assets/') ||
    pathname.startsWith('/raven/terminal-preview/assets/')
  ) {
    await proxyRemoteAsset(req, res, pathname);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`RAVEN server listening on http://0.0.0.0:${PORT}`);
});
