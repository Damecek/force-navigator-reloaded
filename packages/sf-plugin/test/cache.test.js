import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { cacheFilename, CatalogCache } from '../src/services/cache.js';

const scope = {
  orgId: '00D000000000001',
  username: 'user@example.com',
  sources: ['objects', 'static'],
  apiVersion: '62.0',
};

test('CatalogCache isolates scopes, persists safe catalog data, and expires', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'sf-navigator-cache-'));
  t.after(async () => rm(directory, { force: true, recursive: true }));
  let now = 1_000;
  const cache = new CatalogCache({ directory, ttlMs: 100, now: () => now });
  const catalog = { commands: [{ id: 'home' }], errors: [] };

  await cache.write(scope, catalog);
  assert.deepEqual(await cache.read(scope), {
    schemaVersion: 1,
    catalogVersion: 1,
    createdAt: 1_000,
    ...catalog,
  });
  assert.equal(
    await cache.read({ ...scope, username: 'other@example.com' }),
    null
  );
  assert.notEqual(
    cacheFilename(scope),
    cacheFilename({ ...scope, orgId: '00D000000000002' })
  );
  assert.notEqual(
    cacheFilename(scope),
    cacheFilename({ ...scope, apiVersion: '63.0' })
  );

  const serialized = await readFile(
    join(directory, cacheFilename(scope)),
    'utf8'
  );
  assert.equal(serialized.includes('accessToken'), false);
  now = 1_100;
  assert.equal(await cache.read(scope), null);
});

test('CatalogCache treats malformed cache files as misses', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'sf-navigator-cache-'));
  t.after(async () => rm(directory, { force: true, recursive: true }));
  await writeFile(join(directory, cacheFilename(scope)), '{bad json');
  const cache = new CatalogCache({ directory });
  assert.equal(await cache.read(scope), null);
});

test('CatalogCache treats non-object JSON values as misses', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'sf-navigator-cache-'));
  t.after(async () => rm(directory, { force: true, recursive: true }));
  const cache = new CatalogCache({ directory });
  for (const value of [null, false, 42, 'catalog', []]) {
    await writeFile(
      join(directory, cacheFilename(scope)),
      JSON.stringify(value)
    );
    assert.equal(await cache.read(scope), null);
  }
});
