import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createPreviewServer } from '../src/server.js';
import { MAX_REQUESTS_PER_OWNER } from '../src/dialogue.js';

test('HTTP sessions, concurrent idempotency, validation, private history and read-only polling', async t => {
  const server = createPreviewServer();
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise(r => server.close(r)));
  const root = `http://127.0.0.1:${server.address().port}`;
  const session = async () => (await fetch(root)).headers.get('set-cookie').split(';')[0];
  const a = await session(), b = await session();
  const post = (payload, cookie = a) => fetch(root + '/api/dialogue', {method:'POST', headers:{cookie,'content-type':'application/json'}, body:JSON.stringify(payload)});
  assert.equal((await fetch(root+'/api/history?owner=a')).status,401);
  const payload = {requestId:'http-test',characterId:'jonas',message:'سؤال'};
  const responses = await Promise.all(Array.from({length:8}, () => post(payload).then(r=>r.json())));
  assert.equal(responses.filter(r=>!r.replayed).length,1);
  assert.ok(responses.every(r=>r.id==='http-test' && r.status==='completed'));
  assert.equal((await post({...payload,message:'آخر'})).status,409);
  assert.equal((await post(payload,b)).status,403);
  assert.equal((await post({...payload,requestId:'bad',message:{}})).status,400);
  assert.equal((await post({...payload,requestId:'facts',sharedFacts:['secret']})).status,400);
  for (let i=0;i<3;i++) assert.equal((await fetch(root+'/api/operations/http-test',{headers:{cookie:a}})).status,200);
  assert.equal((await fetch(root+'/api/operations/http-test',{headers:{cookie:b}})).status,404);
  assert.equal((await fetch(root+'/api/operations/unknown',{headers:{cookie:a}})).status,404);
  const history = await (await fetch(root+'/api/history?owner=forged',{headers:{cookie:b}})).json();
  assert.deepEqual(history.items,[]);
  const own = await (await fetch(root+'/api/history',{headers:{cookie:a}})).json();
  assert.equal(own.items.length,1);
  assert.equal(own.storage,'server-memory');
});

test('chunked HTTP preserves Unicode across a split UTF-8 character and replays the same operation', async t => {
  const server = createPreviewServer();
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise(r => server.close(r)));
  const root = `http://127.0.0.1:${server.address().port}`;
  const cookie = (await fetch(root)).headers.get('set-cookie').split(';')[0];
  const payload = { requestId:'chunked-unicode', characterId:'jonas', message:'سؤال بالعربية 🪶' };
  const bytes = Buffer.from(JSON.stringify(payload));
  const split = bytes.indexOf(Buffer.from('س')) + 1;
  const first = await new Promise((resolve, reject) => {
    let timer;
    const request = http.request(root + '/api/dialogue', {
      method:'POST', headers:{ cookie, 'content-type':'application/json' },
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('error', reject);
      response.on('end', () => resolve({ status:response.statusCode, body:JSON.parse(Buffer.concat(chunks).toString('utf8')) }));
    });
    request.on('error', error => { clearTimeout(timer); reject(error); });
    request.write(bytes.subarray(0, split));
    // Let the server consume the incomplete character before the next HTTP chunk.
    timer = setTimeout(() => request.end(bytes.subarray(split)), 100);
  });
  assert.equal(first.status, 200);
  assert.equal(first.body.message, payload.message);
  assert.equal(first.body.replayed, false);
  const replay = await (await fetch(root + '/api/dialogue', {
    method:'POST', headers:{ cookie, 'content-type':'application/json' }, body:JSON.stringify(payload),
  })).json();
  assert.equal(replay.replayed, true);
  assert.equal(replay.message, payload.message);
  const saved = await (await fetch(root + '/api/operations/' + payload.requestId, { headers:{ cookie } })).json();
  assert.equal(saved.message, payload.message);
});

// Request-ID contract (cases 01–08 of the request-id fixtures), executed against the real server.
test('request-id contract cases run against the real server: replay, conflicts, key order, race, unknown poll', async t => {
  const server = createPreviewServer();
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise(r => server.close(r)));
  const root = `http://127.0.0.1:${server.address().port}`;
  const cookie = (await fetch(root)).headers.get('set-cookie').split(';')[0];
  const json = {cookie, 'content-type':'application/json'};
  const raw = body => fetch(root + '/api/dialogue', {method:'POST', headers:json, body});
  const post = payload => raw(JSON.stringify(payload));
  const read = async id => (await fetch(root + '/api/operations/' + id, {headers:{cookie}})).json();
  const history = async () => (await (await fetch(root + '/api/history', {headers:{cookie}})).json()).items;

  // 01: a completed operation replays its stored result even after the character's knowledge changes.
  const base = {requestId:'case-01', characterId:'jonas', message:'ما المواد التي وصلتك؟'};
  const first = await (await post(base)).json();
  assert.equal(first.status, 'completed');
  await fetch(root + '/api/materials', {method:'POST', headers:json, body:JSON.stringify({id:'m-01', type:'statement', text:'قول مسجل'})});
  await fetch(root + '/api/shares', {method:'POST', headers:json, body:JSON.stringify({eventId:'e-01', materialId:'m-01', recipients:['jonas']})});
  const again = await (await post(base)).json();
  assert.equal(again.replayed, true);
  assert.deepEqual(again.response, first.response);

  // 02/03/04: the same ID with another message, character or content version is 409 and keeps the original.
  for (const change of [{message:'سؤال آخر'}, {characterId:'claire'}, {contentVersion:'deleted-name-preview-v3'}]) {
    const res = await post({...base, ...change});
    assert.equal(res.status, 409);
    assert.equal((await res.json()).error, 'request_id_conflict');
  }
  const stored = await read('case-01');
  assert.equal(stored.characterId, 'jonas');
  assert.equal(stored.message, base.message);
  assert.deepEqual(stored.response, first.response);

  // 05: the same values in another key order replay instead of conflicting.
  const reordered = await (await raw(`{"message":${JSON.stringify(base.message)},"characterId":"jonas","requestId":"case-01"}`)).json();
  assert.equal(reordered.replayed, true);

  // 07: two concurrent requests with one ID and different content: exactly one wins, without assuming which.
  const [x, y] = await Promise.all([
    post({requestId:'case-07', characterId:'jonas', message:'أ'}),
    post({requestId:'case-07', characterId:'jonas', message:'ب'}),
  ]);
  assert.deepEqual([x.status, y.status].sort(), [200, 409]);
  assert.equal((await read('case-07')).message, x.status === 200 ? 'أ' : 'ب');

  // 08: polling an unknown operation never creates or generates one.
  const before = (await history()).length;
  for (let i = 0; i < 3; i++) {
    assert.equal((await fetch(root + '/api/operations/case-08-unknown', {headers:{cookie}})).status, 404);
  }
  assert.equal((await history()).length, before);
});

// Memory bounds of the in-memory preview: idle expiry, LRU session cap, per-session caps, Secure cookie.
const startWith = async (t, options) => {
  const server = createPreviewServer(options);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise(r => server.close(r)));
  return `http://127.0.0.1:${server.address().port}`;
};
const openSession = async root => (await fetch(root)).headers.get('set-cookie').split(';')[0];
const historyOf = (root, cookie) => fetch(root + '/api/history', { headers:{ cookie } });
const postDialogue = (root, cookie, requestId) => fetch(root + '/api/dialogue', {
  method:'POST', headers:{ cookie, 'content-type':'application/json' },
  body:JSON.stringify({ requestId, characterId:'jonas', message:'سؤال' }),
});

test('an idle session expires together with its operations, and activity keeps it alive', async t => {
  let clock = 0;
  const root = await startWith(t, { sessionIdleMs:1000, now:() => clock });
  const a = await openSession(root);
  assert.equal((await postDialogue(root, a, 'bound-ttl')).status, 200);
  clock = 900; assert.equal((await historyOf(root, a)).status, 200);   // touch
  clock = 1800; assert.equal((await historyOf(root, a)).status, 200);  // 900 since the last touch
  clock = 2801; assert.equal((await historyOf(root, a)).status, 401);  // 1001 idle
  // The page load with the stale cookie issues a fresh session, and the old operation id is free again.
  const reissued = (await fetch(root, { headers:{ cookie:a } })).headers.get('set-cookie');
  assert.ok(reissued && !reissued.startsWith(a));
  assert.equal((await postDialogue(root, reissued.split(';')[0], 'bound-ttl')).status, 200);
});

test('the session cap evicts the least recently used session', async t => {
  const root = await startWith(t, { maxSessions:2 });
  const a = await openSession(root), b = await openSession(root);
  assert.equal((await historyOf(root, a)).status, 200); // a is now the most recent
  const c = await openSession(root);                    // evicts b
  assert.equal((await historyOf(root, b)).status, 401);
  assert.equal((await historyOf(root, a)).status, 200);
  assert.equal((await historyOf(root, c)).status, 200);
});

test('a session keeps at most MAX_REQUESTS_PER_OWNER operations and the oldest becomes unavailable', async t => {
  const root = await startWith(t);
  const cookie = await openSession(root);
  for (let i = 0; i <= MAX_REQUESTS_PER_OWNER; i++) assert.equal((await postDialogue(root, cookie, `bound-cap-${i}`)).status, 200);
  const poll = id => fetch(root + '/api/operations/' + id, { headers:{ cookie } });
  assert.equal((await poll('bound-cap-0')).status, 404);
  assert.equal((await poll(`bound-cap-${MAX_REQUESTS_PER_OWNER}`)).status, 200);
  assert.equal((await (await historyOf(root, cookie)).json()).items.length, MAX_REQUESTS_PER_OWNER);
});

test('material and share caps refuse new records but accept a resend of a registered one', async t => {
  const root = await startWith(t, { maxMaterials:2, maxShares:1 });
  const cookie = await openSession(root);
  const headers = { cookie, 'content-type':'application/json' };
  const material = id => fetch(root + '/api/materials', { method:'POST', headers, body:JSON.stringify({ id, type:'statement', text:'قول ' + id }) });
  assert.equal((await material('m1')).status, 200);
  assert.equal((await material('m2')).status, 200);
  const refusedMaterial = await material('m3');
  assert.equal(refusedMaterial.status, 400);
  assert.equal((await refusedMaterial.json()).error, 'materials_limit');
  assert.equal((await material('m1')).status, 200); // same id and content: an idempotent resend
  const share = (eventId, materialId) => fetch(root + '/api/shares', { method:'POST', headers, body:JSON.stringify({ eventId, materialId, recipients:['jonas'] }) });
  assert.equal((await share('e1', 'm1')).status, 200);
  const refusedShare = await share('e2', 'm2');
  assert.equal(refusedShare.status, 400);
  assert.equal((await refusedShare.json()).error, 'shares_limit');
  assert.equal((await share('e1', 'm1')).status, 200); // resend of the registered event
});

test('the session cookie is Secure when requested for a TLS-terminating proxy', async t => {
  const plain = await startWith(t, { secureCookie:false });
  assert.doesNotMatch((await fetch(plain)).headers.get('set-cookie'), /Secure/);
  const secure = await startWith(t, { secureCookie:true });
  assert.match((await fetch(secure)).headers.get('set-cookie'), /; Secure/);
});
