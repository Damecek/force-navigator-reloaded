import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.__CLIENT_ID__ = 'test-client-id';

function createStorageArea() {
  const records = new Map();

  return {
    async get(keys) {
      if (typeof keys === 'undefined') {
        return Object.fromEntries(records);
      }

      if (Array.isArray(keys)) {
        return Object.fromEntries(
          keys
            .filter((key) => records.has(key))
            .map((key) => [key, records.get(key)])
        );
      }

      if (typeof keys === 'string') {
        return records.has(keys) ? { [keys]: records.get(keys) } : {};
      }

      return {};
    },

    async set(values) {
      for (const [key, value] of Object.entries(values)) {
        records.set(key, value);
      }
    },

    async remove(keys) {
      for (const key of keys) {
        records.delete(key);
      }
    },

    clear() {
      records.clear();
    },
  };
}

const storageArea = createStorageArea();

global.chrome = {
  storage: {
    local: storageArea,
  },
  identity: {
    getRedirectURL() {
      return 'https://example.chromiumapp.org/oauth2';
    },
  },
};

async function loadSharedModule() {
  return import(`../src/shared/index.js?test=${Date.now()}-${Math.random()}`);
}

async function loadCommandRegisterModule() {
  return import(
    `../src/background/commandRegister.js?test=${Date.now()}-${Math.random()}`
  );
}

test.beforeEach(() => {
  storageArea.clear();
});

test('UsageTracker records total usage and preserved active dates', async () => {
  const { COMMAND_ACTIVITY_KEY, GLOBAL_CACHE_SCOPE, UsageTracker } =
    await loadSharedModule();
  const tracker = await UsageTracker.instance();
  await tracker.resetUsage();

  await tracker.incrementUsage('NavigationCommand:one', new Date(2026, 6, 1));
  await tracker.incrementUsage('NavigationCommand:two', new Date(2026, 6, 1));
  await tracker.incrementUsage('LoginAsCommand:one', new Date(2026, 6, 2));

  const stored = await chrome.storage.local.get([
    `${GLOBAL_CACHE_SCOPE}_${COMMAND_ACTIVITY_KEY}`,
  ]);

  assert.equal(await tracker.totalUsage(), 3);
  assert.equal(await tracker.activeDateCount(), 2);
  assert.deepEqual(stored[`${GLOBAL_CACHE_SCOPE}_${COMMAND_ACTIVITY_KEY}`], {
    value: { activeDates: ['2026-07-01', '2026-07-02'] },
    preserve: true,
  });
});

test('UsageTracker keeps only the latest 10 active dates', async () => {
  const { UsageTracker } = await loadSharedModule();
  const tracker = await UsageTracker.instance();
  await tracker.resetUsage();

  for (let day = 1; day <= 12; day += 1) {
    await tracker.incrementUsage('NavigationCommand', new Date(2026, 6, day));
  }

  const activity = await tracker.activity();

  assert.deepEqual(activity.activeDates, [
    '2026-07-03',
    '2026-07-04',
    '2026-07-05',
    '2026-07-06',
    '2026-07-07',
    '2026-07-08',
    '2026-07-09',
    '2026-07-10',
    '2026-07-11',
    '2026-07-12',
  ]);
});

test('UsageTracker reset clears usage and active dates', async () => {
  const { UsageTracker } = await loadSharedModule();
  const tracker = await UsageTracker.instance();
  await tracker.resetUsage();

  await tracker.incrementUsage('NavigationCommand', new Date(2026, 6, 1));
  await tracker.resetUsage();

  assert.equal(await tracker.totalUsage(), 0);
  assert.equal(await tracker.activeDateCount(), 0);
});

test('UsageTracker increments from a command seed when no count is persisted', async () => {
  const { UsageTracker } = await loadSharedModule();
  const tracker = await UsageTracker.instance();
  await tracker.resetUsage();

  const count = await tracker.incrementUsage(
    'extension-options',
    new Date(2026, 6, 1),
    1
  );

  assert.equal(count, 2);
  assert.equal(await tracker.getUsage('extension-options'), 2);
});

test('review command eligibility requires enabled setting, activity, and no authorize command', async () => {
  const { isReviewCommandEligible } = await loadCommandRegisterModule();
  const eligible = {
    commandMap: { NavigationCommand: [], ExtensionOptionsCommand: [{}] },
    reviewEnabled: true,
    totalUsage: 15,
    activeDateCount: 3,
  };

  assert.equal(isReviewCommandEligible(eligible), true);
  assert.equal(
    isReviewCommandEligible({ ...eligible, reviewEnabled: false }),
    false
  );
  assert.equal(
    isReviewCommandEligible({
      ...eligible,
      commandMap: {
        ...eligible.commandMap,
        AuthorizeExtensionCommand: [{}],
      },
    }),
    false
  );
  assert.equal(isReviewCommandEligible({ ...eligible, totalUsage: 14 }), false);
  assert.equal(
    isReviewCommandEligible({ ...eligible, activeDateCount: 2 }),
    false
  );
});
