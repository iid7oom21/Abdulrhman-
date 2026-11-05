import http from 'node:http';
import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createMaterialStore, MaterialError } from './materials.js';
import { submitRequest, listRequests, getRequest, forgetOwner } from './dialogue.js';

// Memory bounds for the in-memory preview. All can be overridden through createPreviewServer options.
export const SESSION_IDLE_MS = 6 * 60 * 60 * 1000;
export const MAX_SESSIONS = 100;
export const MAX_MATERIALS_PER_SESSION = 200;
export const MAX_SHARES_PER_SESSION = 500;

// Session capability issued by the server, not an ownerId supplied in JSON/query strings.
// Anonymous browser session, NOT an authenticated account or durable storage.
export function createPreviewServer({
  createMaterials = createMaterialStore,
  sessionIdleMs = SESSION_IDLE_MS,
  maxSessions = MAX_SESSIONS,
  maxMaterials = MAX_MATERIALS_PER_SESSION,
  maxShares = MAX_SHARES_PER_SESSION,
  // Behind a TLS-terminating proxy the socket is plain HTTP, so Secure must be requested explicitly.
  secureCookie = process.env.RAVEN_COOKIE_SECURE === '1',
  now = Date.now,
} = {}) {
  // owner -> { materials, touchedAt }. Map order is least-recently-used first (re-inserted on each use).
  const sessions = new Map();
  const dropSession = owner => { sessions.delete(owner); forgetOwner(owner); };
  const expired = session => now() - session.touchedAt > sessionIdleMs;
  const liveSession = cookie => {
    const session = sessions.get(cookie);
    if (!session) return null;
    if (expired(session)) { dropSession(cookie); return null; }
    session.touchedAt = now();
    sessions.delete(cookie); sessions.set(cookie, session);
    return session;
  };
  const openSession = () => {
    for (const [owner, session] of sessions) { if (!expired(session)) break; dropSession(owner); }
    while (sessions.size >= maxSessions) dropSession(sessions.keys().next().value);
    const owner = randomBytes(32).toString('hex');
    sessions.set(owner, { materials: createMaterials(), touchedAt: now() });
    return owner;
  };
  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url));
  const fontAssets = new Map([
    ['/raven/terminal-preview/assets/ibm-plex-arabic.woff2', new URL('../../../raven/terminal-preview/assets/ibm-plex-arabic.woff2', import.meta.url)],
    ['/assets/ibm-plex-arabic.woff2', new URL('../../../raven/terminal-preview/assets/ibm-plex-arabic.woff2', import.meta.url)],
    ['/raven/terminal-preview/assets/cinzel.woff2', new URL('../../../raven/terminal-preview/assets/cinzel.woff2', import.meta.url)],
    ['/assets/cinzel.woff2', new URL('../../../raven/terminal-preview/assets/cinzel.woff2', import.meta.url)],
  ]);
  return http.createServer(async (req, res) => {
    const json = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(data, (key, value) => ['owner', 'fingerprint'].includes(key) ? undefined : value));
    };
    try {
      const url = new URL(req.url, 'http://preview.local');
      if (req.method === 'GET' && fontAssets.has(url.pathname)) {
        const fontUrl = fontAssets.get(url.pathname);
        if (fs.existsSync(fontUrl)) {
          res.writeHead(200, { 'Content-Type': 'font/woff2', 'Cache-Control': 'public, max-age=86400' });
          return res.end(fs.readFileSync(fontUrl));
        }
      }
      const cookie = /(?:^|;\s*)raven_preview_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
      const session = cookie ? liveSession(cookie) : null;
      let owner = session ? cookie : null;
      if (req.method === 'GET' && ['/', '/index.html'].includes(url.pathname)) {
        if (!owner) {
          owner = openSession();
          res.setHeader('Set-Cookie', `raven_preview_session=${owner}; HttpOnly; SameSite=Strict; Path=/${req.socket.encrypted || secureCookie ? '; Secure' : ''}`);
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(html);
      }
      if (!owner) return json(401, { error: 'session_unavailable' });
      const materials = session.materials;
      if (req.method === 'GET' && url.pathname === '/api/materials') {
        return json(200, { items:materials.listMaterials(), events:materials.listShareEvents(), storage:'server-memory' });
      }
      if (req.method === 'GET' && url.pathname === '/api/knowledge') {
        const characterId = url.searchParams.get('characterId');
        if (!['jonas','claire','matteo','elena'].includes(characterId)) return json(400, { error:'unknown_character' });
        return json(200, materials.contextFor(characterId, {visibleTo:'player'}));
      }
      if (req.method === 'GET' && url.pathname === '/api/history') {
        return json(200, { items: listRequests(owner), storage: 'server-memory' });
      }
      if (req.method === 'GET' && url.pathname.startsWith('/api/operations/')) {
        const record = getRequest(decodeURIComponent(url.pathname.slice('/api/operations/'.length)), owner);
        return record ? json(200, record) : json(404, { error: 'operation_unavailable' });
      }
      if (req.method === 'POST' && ['/api/dialogue','/api/materials','/api/shares'].includes(url.pathname)) {
        if (!req.headers['content-type']?.startsWith('application/json')) return json(415, { error: 'json_required' });
        if (req.headers['sec-fetch-site'] === 'cross-site') return json(403, { error: 'cross_site' });
        const bodyChunks = [];
        let bodyBytes = 0;
        for await (const chunk of req) {
          bodyBytes += chunk.length;
          if (bodyBytes > 40000) return json(413, { error: 'body_too_large' });
          bodyChunks.push(chunk);
        }
        let data;
        // Decode once: a multi-byte Arabic character can span incoming HTTP chunks.
        try { data = JSON.parse(Buffer.concat(bodyChunks, bodyBytes).toString('utf8')); }
        catch { return json(400, { error: 'invalid_json' }); }
        if (!data || typeof data !== 'object' || Array.isArray(data)) return json(400, { error: 'invalid_request' });
        if (url.pathname === '/api/materials') {
          if (!['statement','correction','motive','private_note','report'].includes(data.type) ||
              typeof data.id !== 'string' || Object.hasOwn(data, 'author')) return json(400, { error:'player_material_required' });
          // A resend of an already-registered id is idempotent and must not hit the cap.
          if (materials.listMaterials().length >= maxMaterials &&
              !materials.listMaterials().some(record => record.id === data.id)) return json(400, { error:'materials_limit' });
          const item = materials.createMaterial({ ...data, author:'player' });
          return json(200, { item:materials.listMaterials().find(record => record.id === item.id), storage:'server-memory' });
        }
        if (url.pathname === '/api/shares') {
          if (Object.keys(data).some(key => !['eventId','materialId','recipients'].includes(key)) || !Array.isArray(data.recipients) || data.recipients.includes('player')) {
            return json(400, { error:'invalid_share' });
          }
          if (materials.listShareEvents().length >= maxShares &&
              !materials.listShareEvents().some(event => event.eventId === data.eventId)) return json(400, { error:'shares_limit' });
          return json(200, { event:materials.share({ ...data, sender:'player' }), storage:'server-memory' });
        }
        if (!['jonas','claire'].includes(data.characterId)) return json(400, { error:'invalid_request' });
        const result = submitRequest(data.requestId, data.characterId, data.message, data.sharedFacts, data.contentVersion, owner, materials.contextFor(data.characterId));
        const status = result.error ? (result.status === 'conflict' ? 409 : result.error === 'forbidden' ? 403 : 400) : 200;
        return json(status, result);
      }
      json(404, { error: 'not_found' });
    } catch (error) {
      if (error instanceof MaterialError) return json(error.code.endsWith('_conflict') ? 409 : 400, { error:error.code });
      if (!res.headersSent) json(500, { error: 'server_error' });
      else res.end();
    }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createPreviewServer().listen(process.env.PORT || 10000, '0.0.0.0', () => console.log('RAVEN preview: simulation, server-memory storage'));
}
