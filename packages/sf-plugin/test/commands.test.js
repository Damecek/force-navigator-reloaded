import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import NavigatorOpen from '../lib/commands/navigator/open.js';
import NavigatorSearch from '../lib/commands/navigator/search.js';

async function commandContext(
  t,
  { flags = {}, args = {}, json = true, query } = {}
) {
  const cacheDir = await mkdtemp(join(tmpdir(), 'navigator-command-test-'));
  t.after(() => rm(cacheDir, { force: true, recursive: true }));
  const calls = { connection: 0, authentication: 0, logs: [], warnings: [] };
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
        'URL-only navigation must not authenticate or open a browser'
      );
    },
  };
  const context = {
    config: { cacheDir },
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

test('open rejects a query with --id before loading org data', async (t) => {
  const { context, calls } = await commandContext(t, {
    flags: { id: 'app-home' },
    args: { query: 'home' },
  });
  await assert.rejects(
    NavigatorOpen.prototype.run.call(context),
    isCommandError(/either a query or --id/)
  );
  assert.equal(calls.connection, 0);
  assert.equal(calls.authentication, 0);
});

test('open rejects ambiguous JSON selection without authenticating', async (t) => {
  const { context, calls } = await commandContext(t);
  await assert.rejects(
    NavigatorOpen.prototype.run.call(context),
    isCommandError(/commands match.*--id/)
  );
  assert.equal(calls.authentication, 0);
});

test('open rejects ambiguous non-TTY selection without prompting', async (t) => {
  const previous = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');
  Object.defineProperty(process.stdin, 'isTTY', {
    value: false,
    configurable: true,
  });
  t.after(() => {
    if (previous) Object.defineProperty(process.stdin, 'isTTY', previous);
    else delete process.stdin.isTTY;
  });
  const { context, calls } = await commandContext(t, { json: false });
  await assert.rejects(
    NavigatorOpen.prototype.run.call(context),
    isCommandError(/commands match.*--id/)
  );
  assert.equal(calls.authentication, 0);
});

test('open URL-only returns the selected org URL without browser authentication', async (t) => {
  const { context, calls } = await commandContext(t, {
    flags: { id: 'app-home', 'url-only': true },
    json: false,
  });
  const result = await NavigatorOpen.prototype.run.call(context);
  assert.equal(result.opened, false);
  assert.equal(result.orgId, '00D000000000001AAA');
  assert.equal(
    result.url,
    'https://example--uat.sandbox.lightning.force.com/lightning/page/home'
  );
  assert.deepEqual(calls.logs, [result.url]);
  assert.equal(calls.authentication, 0);
  assert.equal(JSON.stringify(result).includes('sid='), false);
});

test('search fails when every selected source fails', async (t) => {
  const { context, calls } = await commandContext(t, {
    flags: { source: ['users', 'apex-classes'] },
    query: async () => {
      throw new Error('Source unavailable');
    },
  });
  await assert.rejects(
    NavigatorSearch.prototype.run.call(context),
    isCommandError(/Every selected command source failed to load/)
  );
  assert.equal(calls.warnings.length, 2);
});

test('search returns a valid empty catalog when a source loads without records', async (t) => {
  const { context, calls } = await commandContext(t, {
    flags: { source: ['users'] },
  });
  const result = await NavigatorSearch.prototype.run.call(context);
  assert.deepEqual(result.commands, []);
  assert.deepEqual(result.errors, []);
  assert.equal(calls.warnings.length, 0);
});

test('search preserves partial successes when another selected source fails', async (t) => {
  const { context, calls } = await commandContext(t, {
    flags: { source: ['static', 'users'] },
    query: async () => {
      throw new Error('Source unavailable');
    },
  });
  const result = await NavigatorSearch.prototype.run.call(context);
  assert.ok(result.commands.length > 0);
  assert.deepEqual(
    result.errors.map((error) => error.source),
    ['users']
  );
  assert.equal(calls.warnings.length, 1);
});
