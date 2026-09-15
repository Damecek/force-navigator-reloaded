import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import NavigatorOpen from '../lib/commands/navigator/open.js';

async function commandContext(
  t,
  { flags = {}, args = {}, json = true, query } = {}
) {
  const cacheDir = await mkdtemp(join(tmpdir(), 'navigator-command-test-'));
  t.after(() => rm(cacheDir, { force: true, recursive: true }));
  const calls = {
    connection: 0,
    authentication: 0,
    logs: [],
    warnings: [],
    loading: [],
  };
  const org = {
    getOrgId: () => '00D000000000001AAA',
    getUsername: () => 'navigator-test@example.invalid',
    getConnection: () => {
      calls.connection += 1;
      const runQuery = query ?? (async () => ({ done: true, records: [] }));
      return {
        instanceUrl: 'https://example--uat.sandbox.my.salesforce.com',
        query: runQuery,
        tooling: { query: runQuery },
      };
    },
    getFrontDoorUrl: async () => {
      calls.authentication += 1;
      assert.fail(
        'Rejected navigation must not authenticate or open a browser'
      );
    },
  };
  const context = {
    config: { cacheDir },
    spinner: {
      start: (message) => calls.loading.push(message),
      stop: (status) => calls.loading.push(status),
    },
    parse: async () => ({
      args,
      flags: { 'target-org': org, source: ['static'], refresh: true, ...flags },
    }),
    jsonEnabled: () => json,
    log: (message) => calls.logs.push(message),
    logSuccess: (message) => calls.logs.push(message),
    warn: (message) => calls.warnings.push(message),
    error: (message, options) => {
      throw Object.assign(new Error(message), { exit: options.exit });
    },
  };
  return { context, calls };
}

const isCommandError = (expected) => (error) => {
  assert.equal(error.exit, 1);
  assert.match(error.message, expected);
  return true;
};

function terminal(t, enabled) {
  for (const stream of [process.stdin, process.stdout]) {
    const previous = Object.getOwnPropertyDescriptor(stream, 'isTTY');
    Object.defineProperty(stream, 'isTTY', {
      value: enabled,
      configurable: true,
    });
    t.after(() => {
      if (previous) Object.defineProperty(stream, 'isTTY', previous);
      else delete stream.isTTY;
    });
  }
}

test('open rejects non-TTY use before querying or authenticating', async (t) => {
  terminal(t, false);
  const { context, calls } = await commandContext(t);
  await assert.rejects(
    NavigatorOpen.prototype.run.call(context),
    isCommandError(/interactive terminal/)
  );
  assert.equal(calls.connection, 0);
  assert.equal(calls.authentication, 0);
});

test('open requires a terminal even for a unique prefilled query', async (t) => {
  terminal(t, false);
  const { context, calls } = await commandContext(t, {
    args: { query: 'Developer Console' },
  });
  await assert.rejects(
    NavigatorOpen.prototype.run.call(context),
    isCommandError(/interactive terminal/)
  );
  assert.equal(calls.authentication, 0);
});

test('open fails when every selected source fails instead of prompting', async (t) => {
  terminal(t, true);
  const { context, calls } = await commandContext(t, {
    flags: { source: ['users', 'apex-classes'] },
    query: async () => {
      throw new Error('Source unavailable');
    },
  });
  await assert.rejects(
    NavigatorOpen.prototype.run.call(context),
    isCommandError(/Every selected command source failed to load/)
  );
  assert.equal(calls.warnings.length, 2);
  assert.deepEqual(calls.loading, [
    'Loading Salesforce commands from navigator-test@example.invalid',
    'Failed',
  ]);
  assert.equal(calls.authentication, 0);
});

test('open rejects an empty source selection before connecting', async (t) => {
  terminal(t, true);
  const { context, calls } = await commandContext(t, {
    flags: { source: ['users'], 'exclude-source': ['users'] },
  });
  await assert.rejects(
    NavigatorOpen.prototype.run.call(context),
    isCommandError(/No command sources remain/)
  );
  assert.equal(calls.connection, 0);
});
