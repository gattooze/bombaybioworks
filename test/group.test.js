const test = require('node:test');
const assert = require('node:assert');
const { senderPhone, isFounder, isTagged, Recent } = require('../src/group');
const { toCapture } = require('../src/capture');

const me = { id: '919800000001:12@s.whatsapp.net', lid: '123456789:12@lid' };
const msg = (text, ctx, key = {}) => ({ key: { participant: '919864012345@s.whatsapp.net', ...key }, message: ctx ? { extendedTextMessage: { text, contextInfo: ctx } } : { conversation: text } });

test('finds the sender phone, preferring the phone over a LID', () => {
  assert.equal(senderPhone({ participant: '55555@lid', participantPn: '919864012345@s.whatsapp.net' }), '919864012345');
  assert.equal(senderPhone({ participant: '55555@lid' }), '');
});

test('only listed founders count, and a LID-only sender is not a founder', () => {
  assert.equal(isFounder({ participant: '919864012345@s.whatsapp.net' }, ['919864012345']), true);
  assert.equal(isFounder({ participant: '919864012345@s.whatsapp.net' }, ['9864012345']), true);
  assert.equal(isFounder({ participant: '917000000000@s.whatsapp.net' }, ['919864012345']), false);
  assert.equal(isFounder({ participant: '55555@lid' }, ['919864012345']), false);
});

test('Hive is tagged by the trigger word, an @mention or a reply, and not otherwise', () => {
  assert.equal(isTagged(msg('@hive what is the char price?'), me, '@hive'), true);
  assert.equal(isTagged(msg('hey @Hive log this'), me, '@hive'), true);
  assert.equal(isTagged(msg('the hive is buzzing'), me, '@hive'), false);
  assert.equal(isTagged(msg('@919800000001 price?', { mentionedJid: ['919800000001@s.whatsapp.net'] }), me, '@hive'), true);
  assert.equal(isTagged(msg('and for 2 MT?', { participant: '123456789@lid' }), me, '@hive'), true);
  assert.equal(isTagged(msg('and for 2 MT?', { participant: '917000000000@s.whatsapp.net' }), me, '@hive'), false);
});

test('recent keeps the last N lines', () => {
  const r = new Recent(2);
  r.add('PA', 'one'); r.add('MK', 'two'); r.add('KV', 'three');
  assert.deepEqual(r.lines().map(l => l.split('] ')[1]), ['MK: two', 'KV: three']);
});

test('maps a commitment to a capture payload', () => {
  const c = toCapture({ kind: 'commitment', summary: 'MK sends samples to Ankur', name: '', owner: 'MK', due_date: '2026-12-04', value: '', detail: 'MK: will send Friday' }, { sourceRef: 'whatsapp:abc', sender: 'MK', date: '2026-11-28' });
  assert.deepEqual(c, { kind: 'commitment', summary: 'MK sends samples to Ankur', source_ref: 'whatsapp:abc', payload: { detail: 'MK: will send Friday', said_by: 'MK', date: '2026-11-28', text: 'MK sends samples to Ankur', owner: 'MK', due_date: '2026-12-04' } });
});
