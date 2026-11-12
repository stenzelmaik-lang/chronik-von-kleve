import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { test } from 'node:test';
import { captureMedia, restoreMedia, verifyMedia } from '../scripts/media-backup.mjs';

const key = 'nested/Ä #?/CON';
const data = Buffer.from('original media');
const etag = createHash('md5').update(data).digest('hex');
const item = { key, size: data.length, etag, last_modified: '2026-11-12T00:00:00Z',
  http_metadata: { contentType: 'image/png', cacheControl: 'private, no-store' },
  custom_metadata: { version: 'fixture' }, storage_class: 'Standard' };
const other = { ...item, key: 'nested/second' };

async function paths(t) {
  const dir = await mkdtemp(join(tmpdir(), 'chroniplay-media-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return { archive: join(dir, 'archive'), target: join(dir, 'restore') };
}

function source(open = async () => ({ body: Readable.from([data]), etag })) {
  return {
    identity: 'synthetic',
    listPage: async cursor => ({ objects: cursor === '2' ? [other] : [item], cursor: cursor ? null : '2' }),
    open,
  };
}

test('backs up both pages, preserves original keys and metadata, and restores without the source', async t => {
  const { archive, target } = await paths(t);
  const summary = await captureMedia(source(), archive);
  assert.deepEqual(summary, { objects: 2, bytes: 2 * data.length });
  assert.deepEqual(await verifyMedia(archive), summary);
  const manifest = JSON.parse(await readFile(join(archive, 'manifest.json'), 'utf8'));
  assert.deepEqual(manifest.objects.map(entry => entry.key), [key, other.key]);
  assert.deepEqual(manifest.objects[0].http_metadata, item.http_metadata);
  assert.equal(manifest.objects[0].sha256, createHash('sha256').update(data).digest('hex'));
  assert.deepEqual(await restoreMedia(archive, target), summary);
  await assert.rejects(restoreMedia(archive, target), /EEXIST/);
  await assert.rejects(restoreMedia(archive, archive), /EEXIST/);
  await assert.rejects(captureMedia(source(), archive), /EEXIST/);
  assert.deepEqual(await verifyMedia(archive), summary);
});

test('retries interrupted streams and detects corrupted archive contents before restoring', async t => {
  const { archive, target } = await paths(t);
  let attempts = 0;
  const broken = async function* () {
    yield data.subarray(0, 4);
    throw Object.assign(new Error('interrupted'), { code: 'ECONNRESET' });
  };
  await captureMedia(source(async () => ({ etag, body: Readable.from(++attempts === 1 ? broken() : [data]) })), archive, { retryDelay: 0 });
  assert.equal(attempts, 3);
  const manifest = JSON.parse(await readFile(join(archive, 'manifest.json'), 'utf8'));
  await writeFile(join(archive, 'objects', manifest.objects[0].blob), Buffer.alloc(data.length));
  await assert.rejects(restoreMedia(archive, target), /SHA-256/);
});

test('retries rate limiting and rejects a sealed archive with a missing object', async t => {
  const { archive, target } = await paths(t);
  let attempts = 0;
  await captureMedia(source(async () => {
    if (++attempts === 1) throw Object.assign(new Error('HTTP 429'), { status: 429 });
    return { etag, body: Readable.from([data]) };
  }), archive, { retryDelay: 0 });
  assert.equal(attempts, 3);
  const manifest = JSON.parse(await readFile(join(archive, 'manifest.json'), 'utf8'));
  await rm(join(archive, 'objects', manifest.objects[0].blob));
  await assert.rejects(restoreMedia(archive, target), /ENOENT/);
});

for (const status of [401, 403, 404]) {
  test(`fails on HTTP ${status} without retry and rejects the incomplete archive`, async t => {
    const { archive } = await paths(t);
    let attempts = 0;
    const unavailable = source(async () => {
      attempts++;
      throw Object.assign(new Error(`HTTP ${status}`), { status });
    });
    await assert.rejects(captureMedia(unavailable, archive), new RegExp(`HTTP ${status}`));
    assert.equal(attempts, 1);
    await assert.rejects(verifyMedia(archive), /unvollständig/);
  });
}

test('rejects repeated cursors and source changes during the backup', async t => {
  const { archive, target } = await paths(t);
  const repeated = { ...source(), listPage: async () => ({ objects: [], cursor: 'loop' }) };
  await assert.rejects(captureMedia(repeated, archive), /Cursor/);
  let lists = 0;
  const changed = { ...source(), listPage: async () => ({ objects: [++lists === 1 ? item : other], cursor: null }) };
  await assert.rejects(captureMedia(changed, target), /Bestand hat sich geändert/);
  await assert.rejects(verifyMedia(target), /unvollständig/);
});
