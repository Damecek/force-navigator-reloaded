import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.__CLIENT_ID__ = 'test-client-id';

const { default: AuthAttemptRegistry } =
  await import('../src/background/auth/authAttempts.js');

const LIGHTNING = 'acme.sandbox.lightning.force.com';
const CORE = 'acme.sandbox.my.salesforce.com';

function createRegistry() {
  let counter = 0;
  return new AuthAttemptRegistry({ createId: () => `attempt-${++counter}` });
}

test('begin normalizes the org hostname and snapshots pre-existing tabs', () => {
  const registry = createRegistry();
  const attempt = registry.begin({
    tabId: 1,
    windowId: 10,
    hostname: LIGHTNING,
    openTabIds: [1, 2, 3],
  });
  assert.equal(attempt.orgHostname, CORE);
  assert.equal(attempt.failure, null);
  assert.ok(attempt.openTabIds.has(3));
  assert.equal(registry.isActive(attempt.id), true);
});

test('attributes an error page from a new tab in the same org to the single active attempt', () => {
  const registry = createRegistry();
  const attempt = registry.begin({
    tabId: 1,
    hostname: LIGHTNING,
    openTabIds: [1, 2],
  });
  const match = registry.findForErrorReport({ hostname: CORE, tabId: 7 });
  assert.equal(match, attempt);
});

test('attributes a tab-less report from the auth-flow window to the single active attempt', () => {
  const registry = createRegistry();
  const attempt = registry.begin({
    tabId: 1,
    hostname: LIGHTNING,
    openTabIds: [1, 2],
  });
  assert.equal(
    registry.findForErrorReport({ hostname: CORE, tabId: null }),
    attempt
  );
  assert.equal(registry.findForErrorReport({ hostname: CORE }), attempt);
});

test('does not attribute an error page from a tab that existed before the attempt', () => {
  const registry = createRegistry();
  registry.begin({ tabId: 1, hostname: LIGHTNING, openTabIds: [1, 2] });
  assert.equal(registry.findForErrorReport({ hostname: CORE, tabId: 2 }), null);
  assert.equal(registry.findForErrorReport({ hostname: CORE, tabId: 1 }), null);
});

test('does not attribute an error page from a different org', () => {
  const registry = createRegistry();
  registry.begin({ tabId: 1, hostname: LIGHTNING, openTabIds: [1] });
  assert.equal(
    registry.findForErrorReport({
      hostname: 'other.my.salesforce.com',
      tabId: 9,
    }),
    null
  );
});

test('requires an exact state match when Salesforce echoes state', () => {
  const registry = createRegistry();
  const attempt = registry.begin({
    tabId: 1,
    hostname: LIGHTNING,
    openTabIds: [1],
  });
  assert.equal(
    registry.findForErrorReport({
      hostname: CORE,
      tabId: 9,
      state: 'someone-else',
    }),
    null
  );
  assert.equal(
    registry.findForErrorReport({
      hostname: CORE,
      tabId: 9,
      state: attempt.id,
    }),
    attempt
  );
});

test('refuses to guess between two active attempts for the same org without state', () => {
  const registry = createRegistry();
  const first = registry.begin({
    tabId: 1,
    hostname: LIGHTNING,
    openTabIds: [1, 2],
  });
  const second = registry.begin({
    tabId: 2,
    hostname: CORE,
    openTabIds: [1, 2],
  });
  assert.equal(registry.findForErrorReport({ hostname: CORE, tabId: 9 }), null);
  assert.equal(
    registry.findForErrorReport({ hostname: CORE, tabId: 9, state: second.id }),
    second
  );
  assert.equal(
    registry.findForErrorReport({ hostname: CORE, tabId: 9, state: first.id }),
    first
  );
});

test('an attempt with a recorded failure is not matched again and ends cleanly', () => {
  const registry = createRegistry();
  const attempt = registry.begin({
    tabId: 1,
    hostname: LIGHTNING,
    openTabIds: [1],
  });
  const failure = { kind: 'app_not_installed', confirmed: true };
  registry.recordFailure(attempt.id, failure);
  assert.equal(registry.get(attempt.id).failure, failure);
  assert.equal(registry.findForErrorReport({ hostname: CORE, tabId: 9 }), null);
  const ended = registry.end(attempt.id);
  assert.equal(ended.failure, failure);
  assert.equal(registry.isActive(attempt.id), false);
  assert.equal(registry.recordFailure(attempt.id, failure), null);
});

test('a new attempt from the same tab supersedes the previous one', () => {
  const registry = createRegistry();
  const first = registry.begin({
    tabId: 1,
    hostname: LIGHTNING,
    openTabIds: [1],
  });
  const second = registry.begin({
    tabId: 1,
    hostname: LIGHTNING,
    openTabIds: [1],
  });
  assert.equal(registry.isActive(first.id), false);
  assert.equal(registry.isActive(second.id), true);
});

test('does not attribute an error page from a new tab in the originating window', () => {
  const registry = createRegistry();
  const attempt = registry.begin({
    tabId: 1,
    windowId: 10,
    hostname: LIGHTNING,
    openTabIds: [1],
  });
  assert.equal(
    registry.findForErrorReport({ hostname: CORE, tabId: 9, windowId: 10 }),
    null
  );
  assert.equal(
    registry.findForErrorReport({ hostname: CORE, tabId: 9, windowId: 11 }),
    attempt
  );
});

test('a repeated report of the same error matches the attempt that recorded it', () => {
  const registry = createRegistry();
  const attempt = registry.begin({
    tabId: 1,
    hostname: LIGHTNING,
    openTabIds: [1],
  });
  registry.recordFailure(attempt.id, {
    kind: 'app_not_installed',
    confirmed: true,
    salesforceError: {
      error: 'invalid_client',
      description: 'app must be installed into org',
    },
  });
  assert.equal(
    registry.findForErrorReport({ hostname: CORE, error: 'invalid_client' }),
    attempt
  );
  assert.equal(
    registry.findForErrorReport({ hostname: CORE, error: 'access_denied' }),
    null
  );
  assert.equal(registry.findForErrorReport({ hostname: CORE }), null);
});
