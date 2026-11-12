import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { get } from 'node:https';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const digestPattern = /^[a-f0-9]{64}$/;
const singlePartETag = /^[a-f0-9]{32}$/;
const normalizeETag = etag => typeof etag === 'string' ? etag.replace(/^"|"$/g, '') : '';
const jsonOptions = { flag: 'wx', mode: 0o600 };
const summarize = entries => ({ objects: entries.length, bytes: entries.reduce((sum, entry) => sum + entry.size, 0) });

function objectMetadata(object) {
  if (typeof object?.key !== 'string' || !object.key || !Number.isSafeInteger(object.size) || object.size < 0 || !normalizeETag(object.etag)) {
    throw new Error('Ungültige R2-Objektmetadaten.');
  }
  return {
    key: object.key,
    size: object.size,
    etag: normalizeETag(object.etag),
    last_modified: object.last_modified ?? null,
    http_metadata: object.http_metadata ?? {},
    custom_metadata: object.custom_metadata ?? {},
    storage_class: object.storage_class ?? null,
  };
}

function retryable(error) {
  return error.status === 408 || error.status === 429 || error.status >= 500 ||
    ['ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN', 'ETIMEDOUT', 'ERR_STREAM_PREMATURE_CLOSE', 'MEDIA_INCOMPLETE'].includes(error.code);
}

async function withRetry(operation, retryDelay) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === 2 || !retryable(error)) throw error;
      await delay(retryDelay * 2 ** attempt);
    }
  }
}

async function listAll(source, retryDelay) {
  const objects = new Map();
  const seen = new Set();
  let cursor = null;
  do {
    const page = await withRetry(() => source.listPage(cursor), retryDelay);
    if (!Array.isArray(page.objects)) throw new Error('Ungültige R2-Listenantwort.');
    for (const raw of page.objects) {
      const object = objectMetadata(raw);
      if (objects.has(object.key)) throw new Error('Doppelter Objektschlüssel in der R2-Liste.');
      objects.set(object.key, object);
    }
    cursor = page.cursor;
    if (cursor) {
      if (typeof cursor !== 'string' || seen.has(cursor)) throw new Error('Ungültiger oder wiederholter R2-Cursor.');
      seen.add(cursor);
    }
  } while (cursor);
  return objects;
}

async function newPrivateDirectory(path) {
  const absolute = resolve(path);
  const directory = join(await realpath(dirname(absolute)), basename(absolute));
  const relativePath = relative(await realpath(resolve(import.meta.dirname, '..')), directory);
  if (!relativePath || (!isAbsolute(relativePath) && relativePath !== '..' && !relativePath.startsWith('..' + sep))) {
    throw new Error('Privaten Zielordner außerhalb des Repositorys wählen.');
  }
  await mkdir(directory, { mode: 0o700 });
  return directory;
}

async function download(source, entry, destination) {
  const partial = destination + '.part';
  const sha = createHash('sha256');
  const md5 = singlePartETag.test(entry.etag) ? createHash('md5') : null;
  let size = 0;
  const measure = new Transform({ transform(chunk, encoding, callback) {
    size += chunk.length;
    sha.update(chunk);
    md5?.update(chunk);
    callback(null, chunk);
  } });
  try {
    const response = await source.open(entry.key);
    const receivedETag = normalizeETag(response.etag);
    if ((receivedETag && receivedETag !== entry.etag) || (!receivedETag && !md5)) {
      response.body.destroy();
      throw new Error('Objektversion stimmt nicht mit dem R2-Inventar überein.');
    }
    await pipeline(response.body, measure, createWriteStream(partial, jsonOptions));
    if (size !== entry.size) throw Object.assign(new Error('Dateigröße stimmt nicht.'), { code: 'MEDIA_INCOMPLETE' });
    if (md5 && md5.digest('hex') !== entry.etag) throw new Error('R2-Prüfsumme stimmt nicht.');
    await rename(partial, destination);
    return sha.digest('hex');
  } finally {
    await rm(partial, { force: true });
  }
}

function stableObject(value) {
  return JSON.stringify(value, (_key, field) => field && typeof field === 'object' && !Array.isArray(field)
    ? Object.fromEntries(Object.keys(field).sort().map(key => [key, field[key]])) : field);
}

export async function captureMedia(source, path, { retryDelay = 500 } = {}) {
  const directory = await newPrivateDirectory(path);
  const objectDirectory = join(directory, 'objects');
  await mkdir(objectDirectory);
  const startedAt = new Date().toISOString();
  const listed = await listAll(source, retryDelay);
  const objects = [];
  for (const object of listed.values()) {
    const blob = sha256(object.key);
    try {
      const hash = await withRetry(() => download(source, object, join(objectDirectory, blob)), retryDelay);
      objects.push({ ...object, blob, sha256: hash });
    } catch (error) {
      throw new Error(`Objekt ${objects.length + 1}/${listed.size}: ${error.message}`);
    }
  }
  const final = await listAll(source, retryDelay);
  if (final.size !== listed.size || [...listed].some(([key, object]) => stableObject(object) !== stableObject(final.get(key)))) {
    throw new Error('Der R2-Bestand hat sich geändert. Neue Sicherung erforderlich.');
  }
  const summary = summarize(objects);
  const manifest = JSON.stringify({
    version: 1, source: source.identity, startedAt, finishedAt: new Date().toISOString(),
    count: summary.objects, bytes: summary.bytes, objects,
  });
  await writeFile(join(directory, 'manifest.json'), manifest, jsonOptions);
  await writeFile(join(directory, 'complete.sha256'), sha256(manifest) + '\n', jsonOptions);
  return summary;
}

async function completedManifest(directory) {
  let seal, manifest;
  try {
    seal = (await readFile(join(directory, 'complete.sha256'), 'utf8')).trim();
    manifest = await readFile(join(directory, 'manifest.json'), 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    throw new Error('Sicherung unvollständig: Abschlussmarker oder Manifest fehlt.');
  }
  if (seal !== sha256(manifest)) throw new Error('SHA-256 des Manifests stimmt nicht.');
  const parsed = JSON.parse(manifest);
  if (parsed.version !== 1 || !Array.isArray(parsed.objects)) throw new Error('Unbekanntes Sicherungsformat.');
  const unique = new Set();
  for (const entry of parsed.objects) {
    objectMetadata(entry);
    if (unique.has(entry.key) || entry.blob !== sha256(entry.key) || !digestPattern.test(entry.sha256)) throw new Error('Ungültiges Objekt im Manifest.');
    unique.add(entry.key);
  }
  const summary = summarize(parsed.objects);
  if (summary.objects !== parsed.count || summary.bytes !== parsed.bytes) throw new Error('Unvollständiges Manifest.');
  return parsed.objects;
}

async function checkBytes(stream, entry, index) {
  const hash = createHash('sha256');
  let size = 0;
  for await (const chunk of stream) {
    hash.update(chunk);
    size += chunk.length;
  }
  if (size !== entry.size || hash.digest('hex') !== entry.sha256) throw new Error(`Größe oder SHA-256 von Objekt ${index + 1} stimmt nicht.`);
}

async function verifyObjects(path, objects) {
  for (const [index, entry] of objects.entries()) {
    await checkBytes(createReadStream(join(path, 'objects', entry.blob)), entry, index);
  }
  return summarize(objects);
}

export async function verifyMedia(path) {
  return verifyObjects(path, await completedManifest(path));
}

export async function restoreMedia(path, target) {
  const objects = await completedManifest(path);
  const summary = await verifyObjects(path, objects);
  const directory = await newPrivateDirectory(target);
  const { Miniflare, convertV4MiniflareOptions } = await import('miniflare');
  const miniflare = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    script: 'export default {fetch() { return new Response(null, {status: 404}); }}',
    compatibilityDate: '2026-09-21',
    r2Buckets: { BUCKET: 'chroniplay-isolated-media-restore' },
    resourcePersistencePath: directory,
  }));
  try {
    const bucket = await miniflare.getR2Bucket('BUCKET');
    for (const entry of objects) {
      const bytes = await readFile(join(path, 'objects', entry.blob));
      if (bytes.length !== entry.size || sha256(bytes) !== entry.sha256) throw new Error('Archiv wurde während des Restores verändert.');
      const httpMetadata = { ...entry.http_metadata };
      if (httpMetadata.cacheExpiry) httpMetadata.cacheExpiry = new Date(httpMetadata.cacheExpiry);
      await bucket.put(entry.key, bytes, { httpMetadata, customMetadata: entry.custom_metadata });
    }
    for (const [index, entry] of objects.entries()) {
      const object = await bucket.get(entry.key);
      if (!object || object.size !== entry.size) throw new Error(`Objekt ${index + 1} fehlt im Testspeicher oder ist unvollständig.`);
      await checkBytes(object.body, entry, index);
      if (stableObject(object.httpMetadata ?? {}) !== stableObject(entry.http_metadata) ||
          stableObject(object.customMetadata ?? {}) !== stableObject(entry.custom_metadata)) {
        throw new Error(`Metadaten von Objekt ${index + 1} stimmen im Testspeicher nicht.`);
      }
    }
    let count = 0, bytes = 0, cursor;
    do {
      const page = await bucket.list({ cursor });
      count += page.objects.length;
      bytes += page.objects.reduce((sum, object) => sum + object.size, 0);
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    if (count !== summary.objects || bytes !== summary.bytes) throw new Error('Testspeicher enthält einen abweichenden Gesamtbestand.');
  } finally {
    await miniflare.dispose();
  }
  await writeFile(join(directory, 'restore-verified.json'), JSON.stringify({ ...summary, verifiedAt: new Date().toISOString() }), jsonOptions);
  return summary;
}

function requestR2(path, token) {
  return new Promise((resolveRequest, reject) => {
    const request = get({ hostname: 'api.cloudflare.com', path, headers: { Authorization: `Bearer ${token}`, 'Accept-Encoding': 'identity' } }, response => {
      if (response.statusCode !== 200) {
        response.resume();
        reject(Object.assign(new Error(`Cloudflare HTTP ${response.statusCode}`), { status: response.statusCode }));
      } else {
        resolveRequest(response);
      }
    });
    request.on('error', reject);
    request.setTimeout(120_000, () => request.destroy(Object.assign(new Error('Zeitlimit beim Lesen aus R2.'), { code: 'ETIMEDOUT' })));
  });
}

export function cloudflareR2Source(account, bucket, token) {
  if (!/^[a-f0-9]{32}$/.test(account) || !/^[a-z0-9][a-z0-9-]*$/.test(bucket) || !token) {
    throw new Error('Cloudflare-Konto, R2-Bucket und lokales CLOUDFLARE_API_TOKEN angeben.');
  }
  const endpoint = `/client/v4/accounts/${account}/r2/buckets/${bucket}/objects`;
  return {
    identity: `r2:${account}/${bucket}`,
    async listPage(cursor) {
      const query = new URLSearchParams({ per_page: '1000' });
      if (cursor) query.set('cursor', cursor);
      const body = await requestR2(`${endpoint}?${query}`, token);
      const chunks = [];
      for await (const chunk of body) chunks.push(chunk);
      const page = JSON.parse(Buffer.concat(chunks));
      const next = page.result_info?.cursor || null;
      if (!page.success || Boolean(page.result_info?.is_truncated) !== Boolean(next)) throw new Error('Ungültige R2-Listenantwort oder fehlender Cursor.');
      return { objects: page.result, cursor: next };
    },
    async open(key) {
      const encoded = key.split('/').map(segment => /^\.{1,2}$/.test(segment) ? segment.replaceAll('.', '%2E') : encodeURIComponent(segment)).join('/');
      const body = await requestR2(`${endpoint}/${encoded}`, token);
      return { body, etag: body.headers.etag };
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [action, first, second, third, ...extra] = process.argv.slice(2);
    let result;
    if (action === 'backup' && first && second && third && !extra.length) {
      result = await captureMedia(cloudflareR2Source(first, second, process.env.CLOUDFLARE_API_TOKEN), third);
    } else if (action === 'verify' && first && !second) {
      result = await verifyMedia(first);
    } else if (action === 'restore-local' && first && second && !third) {
      result = await restoreMedia(first, second);
    } else {
      throw new Error('Aufruf: backup <Konto-ID> <Bucket> <neues Archiv> | verify <Archiv> | restore-local <Archiv> <neuer Testordner>');
    }
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
