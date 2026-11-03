import test from 'node:test';
import assert from 'node:assert/strict';
import {VISION_PRESETS,MESSAGE_LAYOUTS,visionFragments,fragmentDuration,resolveRecipients,deliveryStatus,playerDeliveries,documentNumber,presetById,MAX_FRAGMENTS,MAX_FRAGMENT_CHARS} from '../domain/personal-delivery.ts';
import {sceneWhisperSchema} from '../domain/story-scene.ts';

const run = (over = {}) => ({ id: 'a1b2c3d4-0000-4000-8000-000000000001', whisperId: 'w', sceneId: 's', sceneVersion: 1, kind: 'vision', preset: 'dark', layout: 'fax', title: 'INTERNAL_TITLE', sender: '', fragments: ['eins'], html: '', imageFileIds: ['img-1'], audioFileId: null, recipients: ['a', 'b'], createdAt: '2026-11-03T10:00:00.000Z', createdBy: 'gm', withdrawnAt: null, receipts: {}, ...over });

test('six distinct vision presets and the planned message layouts', () => {
  assert.deepEqual(VISION_PRESETS.map(p => p.id), ['classic', 'dream', 'dark', 'threat', 'drama', 'echo']);
  for (const p of VISION_PRESETS) assert.ok(p.label && p.mood && p.enterMs >= 2000 && p.baseMs > 0 && p.imageMotion, p.id);
  assert.equal(new Set(VISION_PRESETS.map(p => p.imageMotion)).size, 6, 'every preset moves its pictures differently');
  assert.deepEqual(MESSAGE_LAYOUTS.map(l => l.id), ['fax', 'letter']);
  assert.equal(presetById('nope').id, 'classic');
});

test('fragments: explicit sections win, otherwise paragraphs; long text is split at sentences; never more than 20', () => {
  assert.deepEqual(visionFragments(['  Erster ', '', 'Zweiter'], 'ignoriert'), ['Erster', 'Zweiter']);
  assert.deepEqual(visionFragments(undefined, 'Absatz eins\n\nAbsatz zwei\nZeile drei'), ['Absatz eins', 'Absatz zwei', 'Zeile drei']);
  const long = Array.from({ length: 40 }, (_, i) => `Satz Nummer ${i} trägt etwas Gewicht.`).join(' ');
  const parts = visionFragments([], long);
  assert.ok(parts.length > 1 && parts.every(p => p.length <= MAX_FRAGMENT_CHARS), 'split into readable parts');
  assert.ok(parts.every(p => /\.$/.test(p)), 'split at sentence ends');
  assert.equal(visionFragments(Array.from({ length: 30 }, (_, i) => 'x' + i), '').length, MAX_FRAGMENTS);
});

test('reading time grows with text, stays bounded, and reduced effects add time instead of removing it', () => {
  const short = fragmentDuration('Kurz.', 'classic'), long = fragmentDuration('x'.repeat(400), 'classic');
  assert.ok(short >= 3500 && long > short && long <= 16000);
  assert.ok(fragmentDuration('x'.repeat(120), 'dark', true) > fragmentDuration('x'.repeat(120), 'dark'));
});

test('recipients: prepared, whole group or a choice; never a silent fallback to another group', () => {
  const table = ['a', 'b', 'c'];
  assert.deepEqual(resolveRecipients({ mode: 'prepared' }, ['b'], table), ['b']);
  assert.deepEqual(resolveRecipients({ mode: 'all' }, ['b'], table), table);
  assert.deepEqual(resolveRecipients({ mode: 'players', playerIds: ['c', 'a', 'c'] }, [], table), ['c', 'a']);
  assert.throws(() => resolveRecipients({ mode: 'prepared' }, [], table), /keine Empfänger/);
  assert.throws(() => resolveRecipients({ mode: 'players', playerIds: ['z'] }, [], table), /nimmt nicht an dieser Runde teil/);
  assert.throws(() => resolveRecipients({ mode: 'all' }, [], []), /mindestens einen/);
});

test('status per recipient: pending, running, acknowledged, withdrawn', () => {
  const r = run({ receipts: { a: { seenAt: 't' }, b: { seenAt: 't', ackAt: 't' } } });
  assert.equal(deliveryStatus(r, 'a'), 'running');
  assert.equal(deliveryStatus(r, 'b'), 'acknowledged');
  assert.equal(deliveryStatus(run(), 'a'), 'pending');
  assert.equal(deliveryStatus(run({ withdrawnAt: 't' }), 'a'), 'withdrawn');
});

test('a player gets only own active deliveries, without internal title, other recipients or origin', () => {
  const runs = [run(), run({ id: 'a1b2c3d4-0000-4000-8000-000000000002', recipients: ['b'] }), run({ id: 'a1b2c3d4-0000-4000-8000-000000000003', withdrawnAt: 't' }), run({ id: 'a1b2c3d4-0000-4000-8000-000000000004', receipts: { a: { ackAt: 't' } } })];
  const mine = playerDeliveries(runs, 'a');
  assert.equal(mine.length, 1);
  const text = JSON.stringify(mine);
  for (const secret of ['INTERNAL_TITLE', '"recipients"', '"createdBy"', '"sceneId"', '"whisperId"', '"receipts"']) assert.ok(!text.includes(secret), secret);
  assert.deepEqual(playerDeliveries(runs, 'c'), []);
});

test('fax document number is stable and short', () => {
  assert.equal(documentNumber('a1b2c3d4-0000-4000-8000-000000000001'), 'CP-A1B2C3');
});

test('scene entries: old ones stay valid, new options are checked', () => {
  const base = { id: '0a3f0d6e-5b0a-4b6e-9d0a-6a5b6a9e8c11', kind: 'vision', title: 'V', text: 'Text', recipientIds: [], fileIds: [] };
  assert.equal(sceneWhisperSchema.parse(base).preset, undefined);
  const full = sceneWhisperSchema.parse({ ...base, preset: 'threat', fragments: ['a', 'b'], note: 'intern', audioFileId: 'snd' });
  assert.equal(full.preset, 'threat');
  assert.throws(() => sceneWhisperSchema.parse({ ...base, preset: 'godlike' }));
  assert.throws(() => sceneWhisperSchema.parse({ ...base, fragments: Array(21).fill('x') }));
  assert.equal(sceneWhisperSchema.parse({ ...base, kind: 'letter', layout: 'fax', sender: 'Kanzlei' }).layout, 'fax');
  assert.throws(() => sceneWhisperSchema.parse({ ...base, kind: 'letter', layout: 'telegram' }));
});
