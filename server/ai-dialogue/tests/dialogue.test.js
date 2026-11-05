import { test } from 'node:test';
import assert from 'node:assert/strict';
import { submitRequest, simulateReply, fingerprint, _reset, getRequest, listRequests } from '../src/dialogue.js';
import { buildContext } from '../src/knowledge.js';

test('same operation replays, a different payload conflicts even when its prefix matches', () => {
  _reset();
  const first = submitRequest('id1', 'jonas', 'سؤال أول', [], undefined, 'a');
  assert.equal(first.status, 'completed');
  assert.equal(submitRequest('id1', 'jonas', 'سؤال أول', [], undefined, 'a').replayed, true);
  assert.equal(submitRequest('id1', 'jonas', 'سؤال آخر', [], undefined, 'a').status, 'conflict');
  assert.notEqual(fingerprint({ characterId:'jonas', message:'1' }), fingerprint({ characterId:'jonas', message:'2' }));
  assert.equal(listRequests('a').length, 1);
});
test('owner required, read/poll never generates and cannot cross owners', () => {
  _reset();
  submitRequest('private', 'claire', 'سؤال', [], undefined, 'a');
  assert.equal(getRequest('private', 'b'), null);
  assert.equal(getRequest('private'), null);
  assert.equal(getRequest('missing', 'a'), null);
  assert.equal(listRequests('b').length, 0);
  assert.equal(submitRequest('private', 'claire', 'سؤال', [], undefined, 'b').error, 'forbidden');
});
test('no recovered transcript means no invented presence or testimony', () => {
  for (const char of ['jonas','claire']) {
    const r = simulateReply(char, 'كنت معي وقت الصرخة؟ فيكتور مات؟');
    assert.equal(r.refused, true);
    assert.match(r.text, /غير متاح/);
    assert.doesNotMatch(r.text, /كنا نتكلم|ضيفه/);
    assert.deepEqual(buildContext(char).allowed, []);
  }
});
test('client facts/corrections/motives/report cannot grant character knowledge', () => {
  assert.equal(submitRequest('share', 'jonas', 'سؤال', ['private_correction_shared'], undefined, 'a').error, 'untrusted_facts');
  assert.deepEqual(buildContext('claire', ['report','motive','receipt']), {characterId:'claire', allowed:[]});
});
test('unknown character/types are validation errors', () => {
  for (const character of ['elena', '__proto__']) assert.equal(submitRequest('x',character,'سؤال',[],undefined,'a').error,'invalid_request');
  assert.equal(submitRequest('x','jonas',42,[],undefined,'a').error,'invalid_request');
});
