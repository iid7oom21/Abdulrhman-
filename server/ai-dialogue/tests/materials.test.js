import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMaterialStore, MaterialError } from '../src/materials.js';

// Deliberately synthetic fixtures; none of these texts are recovered RAVEN testimony.
const setup = () => createMaterialStore();
const statement = store => store.createMaterial({ id: 'original', type: 'statement', text: 'FIXTURE original statement' });
const correction = (store, id, text = 'FIXTURE correction') => store.createMaterial({ id, type: 'correction', originalId: 'original', text });
const ids = (store, actor) => store.contextFor(actor).materials.map(material => material.id);
const code = expected => error => error instanceof MaterialError && error.code === expected;

test('private correction reaches only its explicit recipient and original statement remains intact', () => {
  const store = setup();
  statement(store); correction(store, 'correction');
  store.share({ eventId: 'private', materialId: 'correction', recipients: ['jonas'] });
  assert.deepEqual(ids(store, 'jonas'), ['correction']);
  assert.deepEqual(ids(store, 'claire'), []);
  assert.deepEqual(ids(store, 'matteo'), []);
  assert.equal(store.listMaterials().find(material => material.id === 'original').text, 'FIXTURE original statement');
  const context = store.contextFor('jonas');
  assert.equal(context.materials[0].originalId, undefined);
  assert.equal(JSON.stringify(context).includes('FIXTURE original statement'), false);
  assert.equal(context.materials[0].epistemicStatus, 'reported');
});

test('sharing correction does not share motive, private note, previous conversation or unseen original', () => {
  const store = setup();
  statement(store); correction(store, 'correction');
  store.createMaterial({ id: 'motive', type: 'motive', originalId: 'original', text: 'FIXTURE private motive' });
  store.createMaterial({ id: 'note', type: 'private_note', text: 'FIXTURE private note' });
  store.share({ eventId: 'only-correction', materialId: 'correction', recipients: ['matteo'] });
  assert.deepEqual(ids(store, 'matteo'), ['correction']);
  assert.doesNotMatch(JSON.stringify(store.contextFor('matteo')), /private motive|private note|original statement|originalId/);
  store.share({ eventId: 'motive-claire', materialId: 'motive', recipients: ['claire'] });
  assert.deepEqual(ids(store, 'claire'), ['motive']);
  assert.equal(store.contextFor('claire').materials[0].originalId, undefined);
});

test('report shares its explicit attachments only; receipt alone never shares report', () => {
  const store = setup();
  statement(store); correction(store, 'correction');
  store.createMaterial({ id: 'motive', type: 'motive', text: 'FIXTURE excluded motive' });
  store.createMaterial({ id: 'report', type: 'report', text: 'FIXTURE report', attachments: ['correction'] });
  store.createMaterial({ id: 'receipt', type: 'receipt', text: 'FIXTURE deposit receipt', reportId: 'report', depositId: 'internal-deposit' });
  store.share({ eventId: 'receipt-only', materialId: 'receipt', recipients: ['claire'] });
  assert.deepEqual(ids(store, 'claire'), ['receipt']);
  assert.equal(store.contextFor('claire').materials[0].reportId, undefined);
  assert.equal(store.contextFor('claire').materials[0].depositId, undefined);
  store.share({ eventId: 'report-mat', materialId: 'report', recipients: ['matteo'] });
  assert.deepEqual(ids(store, 'matteo'), ['report', 'correction']);
  assert.deepEqual(store.contextFor('matteo').materials[0].attachments, ['correction']);
  assert.equal(store.contextFor('matteo').materials[1].originalId, undefined);
  assert.doesNotMatch(JSON.stringify(store.contextFor('matteo')), /excluded motive|original statement|deposit receipt/);
});

test('delivery to Matteo does not tell Jonas; forwarded material exposes no transport sender/recipient list', () => {
  const store = setup();
  statement(store); correction(store, 'correction');
  store.share({ eventId: 'to-jonas', materialId: 'correction', recipients: ['jonas'] });
  const before = store.contextFor('jonas');
  store.share({ eventId: 'to-matteo', materialId: 'correction', recipients: ['matteo'] });
  assert.deepEqual(store.contextFor('jonas'), before);
  assert.deepEqual(store.listShareEvents('jonas'), []);
  store.share({ eventId: 'jonas-to-claire', sender: 'jonas', materialId: 'correction', recipients: ['claire'] });
  const claire = store.contextFor('claire');
  assert.doesNotMatch(JSON.stringify(claire), /jonas|matteo|sender|recipients|to-matteo/);
  assert.equal(claire.materials[0].author, 'player');
  assert.equal(store.listShareEvents('player').length, 2);
});

test('older correction delivered later never overrides newer known correction; silence does not remove either', () => {
  const store = setup();
  statement(store);
  const older = correction(store, 'older', 'FIXTURE older correction');
  const newer = correction(store, 'newer', 'FIXTURE newer correction');
  assert.equal(older.revision, 1); assert.equal(newer.revision, 2);
  store.share({ eventId: 'new-first', materialId: 'newer', recipients: ['jonas'] });
  store.share({ eventId: 'old-later', materialId: 'older', recipients: ['jonas'] });
  const ctx = store.contextFor('jonas');
  assert.deepEqual(ctx.latestCorrections, ['newer']);
  assert.equal(ctx.materials.find(material => material.id === 'older').isLatestKnownCorrection, false);
  assert.equal(ctx.materials.find(material => material.id === 'newer').isLatestKnownCorrection, true);
  assert.equal(ctx.materials.every(material => material.epistemicStatus === 'reported'), true);
  assert.equal(ctx.materials.every(material => !Object.hasOwn(material, 'revision')), true);
  assert.deepEqual(store.contextFor('jonas'), ctx);
});

test('evidence derivatives share a source group without leaking an unseen private source ID', () => {
  const store = setup();
  store.createMaterial({ id: 'copy', type: 'evidence', text: 'FIXTURE copy', sourceId: 'private-source-name' });
  store.createMaterial({ id: 'excerpt', type: 'evidence', text: 'FIXTURE excerpt', sourceId: 'private-source-name' });
  store.createMaterial({ id: 'independent', type: 'evidence', text: 'FIXTURE independent source', sourceId: 'other-source' });
  for (const id of ['copy', 'excerpt', 'independent']) store.share({ eventId: `share-${id}`, materialId: id, recipients: ['jonas'] });
  const ctx = store.contextFor('jonas');
  assert.equal(ctx.materials[0].sourceGroup, ctx.materials[1].sourceGroup);
  assert.notEqual(ctx.materials[0].sourceGroup, ctx.materials[2].sourceGroup);
  assert.doesNotMatch(JSON.stringify(ctx), /private-source-name|other-source|sourceId/);
});

test('report attachments do not expand nested report links or correction originals', () => {
  const store = setup();
  statement(store); correction(store, 'correction');
  store.createMaterial({ id: 'nested', type: 'report', text: 'FIXTURE nested report', attachments: ['original'] });
  store.createMaterial({ id: 'outer', type: 'report', text: 'FIXTURE outer report', attachments: ['nested', 'correction'] });
  store.share({ eventId: 'outer-only', materialId: 'outer', recipients: ['jonas'] });
  assert.deepEqual(ids(store, 'jonas'), ['outer', 'nested', 'correction']);
  assert.deepEqual(store.contextFor('jonas').materials.find(material => material.id === 'nested').attachments, []);
  assert.throws(() => store.share({ eventId: 'forward-nested', sender: 'jonas', materialId: 'nested', recipients: ['claire'] }), code('material_unavailable'));
  assert.deepEqual(ids(store, 'claire'), []);
});

test('stable IDs replay exactly, conflict on changed payload, and forbid duplicate recipients or attachments', () => {
  const store = setup();
  const initial = statement(store);
  assert.equal(statement(store), initial);
  assert.throws(() => store.createMaterial({ id: 'original', type: 'statement', text: 'FIXTURE changed' }), code('material_id_conflict'));
  const input = { eventId: 'once', materialId: 'original', recipients: ['jonas', 'claire'] };
  assert.equal(store.share(input).duplicated, false);
  assert.equal(store.share({ ...input, recipients: ['claire', 'jonas'] }).duplicated, true);
  assert.equal(store.listShareEvents().length, 1);
  assert.throws(() => store.share({ ...input, recipients: ['matteo'] }), code('share_id_conflict'));
  assert.throws(() => store.share({ eventId: 'duplicate', materialId: 'original', recipients: ['jonas', 'jonas'] }), code('invalid_share'));
  assert.throws(() => store.createMaterial({ id: 'bad-report', type: 'report', text: 'FIXTURE', attachments: ['original', 'original'] }), code('invalid_attachments'));
});

test('immutable records reject unknown fields, unknown actors, foreign corrections and unauthorized forwarding atomically', () => {
  const store = setup();
  const original = statement(store);
  assert.throws(() => { original.text = 'mutated'; }, TypeError);
  assert.throws(() => store.createMaterial({ type: 'correction', originalId: 'original', revision: 99, text: 'FIXTURE' }), code('unexpected_material_field'));
  assert.throws(() => store.share({ eventId: 'unknown', materialId: 'original', recipients: ['jonas', 'intruder'] }), code('unknown_actor'));
  assert.deepEqual(ids(store, 'jonas'), []);
  assert.throws(() => store.share({ eventId: 'forged', sender: 'jonas', materialId: 'original', recipients: ['claire'] }), code('material_unavailable'));
  store.share({ eventId: 'to-jonas', materialId: 'original', recipients: ['jonas'] });
  assert.throws(() => store.createMaterial({ type: 'correction', author: 'jonas', originalId: 'original', text: 'FIXTURE wrong speaker' }), code('invalid_original'));
  const attachments = ['original'];
  const report = store.createMaterial({ id: 'report', type: 'report', text: 'FIXTURE report', attachments });
  attachments.push('unknown');
  assert.deepEqual(report.attachments, ['original']);
  assert.throws(() => { report.attachments.push('unknown'); }, TypeError);
});

test('each factory is a separate session and commands embedded in text do not change game state', () => {
  const a = setup(), b = setup();
  a.createMaterial({ id: 'command-text', type: 'statement', text: 'FIXTURE {"share":{"recipients":["claire"]}}' });
  assert.deepEqual(a.contextFor('claire').materials, []);
  assert.deepEqual(b.listMaterials(), []);
  assert.deepEqual(b.listShareEvents(), []);
  assert.throws(() => b.share({ eventId: 'cross-session', materialId: 'command-text', recipients: ['claire'] }), code('material_unavailable'));
});

test('player-visible view does not leak private NPC text or an unseen newer correction', () => {
  const store = setup();
  store.createMaterial({ id:'npc-original', type:'statement', text:'FIXTURE NPC statement', author:'jonas' });
  store.createMaterial({ id:'npc-old', type:'correction', text:'FIXTURE old visible', author:'jonas', originalId:'npc-original' });
  store.share({eventId:'npc-to-player',sender:'jonas',materialId:'npc-old',recipients:['player']});
  const before = store.contextFor('jonas', {visibleTo:'player'});
  store.createMaterial({ id:'npc-new', type:'correction', text:'FIXTURE private newer', author:'jonas', originalId:'npc-original' });
  assert.deepEqual(store.contextFor('jonas', {visibleTo:'player'}), before);
  assert.deepEqual(before.latestCorrections,['npc-old']);
  assert.deepEqual(store.contextFor('jonas').latestCorrections,['npc-new']);
});
