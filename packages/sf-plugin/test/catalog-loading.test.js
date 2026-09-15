import assert from 'node:assert/strict';
import test from 'node:test';
import { getCatalog } from '../lib/services/catalog.js';

function fixture({
  hit = false,
  fail = false,
  refresh = false,
  sources = ['users'],
} = {}) {
  const events = [];
  const runQuery = async () => {
    events.push('query');
    if (fail) throw new Error('Unavailable');
    return { records: [], done: true };
  };
  const options = {
    org: {
      getOrgId: () => 'org',
      getUsername: () => 'user',
      getConnection: () => ({ query: runQuery, tooling: { query: runQuery } }),
    },
    sources,
    refresh,
    apiVersion: '62.0',
    cache: {
      read: async () => {
        events.push('read');
        return hit ? { commands: [], errors: [], createdAt: 1 } : null;
      },
      write: async () => {
        events.push('write');
      },
    },
    onLoadStart: () => events.push('start'),
    onLoadEnd: (status) => events.push(status),
  };
  return { options, events };
}

test('a cache hit skips org requests and loading events', async () => {
  const { options, events } = fixture({ hit: true });
  assert.equal((await getCatalog(options)).cached, true);
  assert.deepEqual(events, ['read']);
});

test('a cache miss brackets org requests and cache writes with loading events', async () => {
  const { options, events } = fixture();
  assert.equal((await getCatalog(options)).cached, false);
  assert.deepEqual(events, ['read', 'start', 'query', 'write', 'Done']);
});

test('refresh bypasses cached results and shows loading', async () => {
  const { options, events } = fixture({ hit: true, refresh: true });
  await getCatalog(options);
  assert.deepEqual(events, ['start', 'query', 'write', 'Done']);
});

test('loading finishes with partial or failed status when sources fail', async () => {
  for (const sources of [['users'], ['static', 'users']]) {
    const { options, events } = fixture({ sources, fail: true });
    const catalog = await getCatalog(options);
    assert.equal(catalog.errors.length, 1);
    assert.deepEqual(events, [
      'read',
      'start',
      'query',
      sources.length === 1 ? 'Failed' : 'Partial',
    ]);
  }
});

test('loading always stops if saving the cache throws', async () => {
  const { options, events } = fixture();
  options.cache.write = async () => {
    throw new Error('Disk full');
  };
  await assert.rejects(getCatalog(options), /Disk full/);
  assert.equal(events.at(-1), 'Failed');
});

test('static-only loading does not report communication with an org', async () => {
  const { options, events } = fixture({ sources: ['static'] });
  await getCatalog(options);
  assert.deepEqual(events, ['read', 'write']);
});
