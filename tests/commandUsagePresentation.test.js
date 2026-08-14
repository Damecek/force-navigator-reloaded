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

      return records.has(keys) ? { [keys]: records.get(keys) } : {};
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
};

async function loadSharedModule() {
  return import(`../src/shared/index.js?test=${Date.now()}-${Math.random()}`);
}

async function loadUsagePresentationModule() {
  try {
    return await import(
      `../src/lwc/modules/shared/x/commandItem/usagePresentation.js?test=${Date.now()}-${Math.random()}`
    );
  } catch {
    return undefined;
  }
}

async function loadUsageSettingsModule() {
  try {
    return await import(
      `../src/lwc/modules/content/x/commandPalette/usageSettings.js?test=${Date.now()}-${Math.random()}`
    );
  } catch {
    return undefined;
  }
}

function createDeferred() {
  let resolve;
  const promise = new Promise((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

test.beforeEach(() => {
  storageArea.clear();
});

test('usage presentation is enabled by default in persisted settings', async () => {
  const {
    COMMAND_PALETTE_SETTINGS_KEY,
    COMMAND_PALETTE_SHOW_USAGE_SETTINGS_KEY,
    getSetting,
  } = await loadSharedModule();

  assert.equal(
    await getSetting([
      COMMAND_PALETTE_SETTINGS_KEY,
      COMMAND_PALETTE_SHOW_USAGE_SETTINGS_KEY,
    ]),
    true
  );
});

test('usage presentation hides zero usage', async () => {
  const presentationModule = await loadUsagePresentationModule();

  assert.equal(typeof presentationModule?.getUsagePresentation, 'function');
  assert.deepEqual(
    presentationModule.getUsagePresentation(
      { label: 'Flow Builder', usage: 0 },
      true
    ),
    {
      accessibleLabel: 'Flow Builder',
      isVisible: false,
      text: '',
    }
  );
});

test('usage presentation hides positive usage when disabled', async () => {
  const presentationModule = await loadUsagePresentationModule();

  assert.equal(typeof presentationModule?.getUsagePresentation, 'function');
  assert.deepEqual(
    presentationModule.getUsagePresentation(
      { label: 'Flow Builder', usage: 12 },
      false
    ),
    {
      accessibleLabel: 'Flow Builder',
      isVisible: false,
      text: '',
    }
  );
});

test('usage presentation exposes enabled positive usage visually and accessibly', async () => {
  const presentationModule = await loadUsagePresentationModule();

  assert.equal(typeof presentationModule?.getUsagePresentation, 'function');
  assert.deepEqual(
    presentationModule.getUsagePresentation(
      { label: 'Flow Builder', usage: 12 },
      true
    ),
    {
      accessibleLabel: 'Flow Builder, 12 uses',
      isVisible: true,
      text: '12 uses',
    }
  );
});

test('usage settings loading hides usage when storage rejects', async () => {
  const settingsModule = await loadUsageSettingsModule();
  const appliedValues = [];

  assert.equal(typeof settingsModule?.createUsageSettingsLoader, 'function');
  const loader = settingsModule.createUsageSettingsLoader({
    loadSettings: async () => {
      throw new Error('storage unavailable');
    },
    onResolved: (showUsage) => appliedValues.push(showUsage),
  });

  await loader.load();

  assert.deepEqual(appliedValues, [false]);
});

test('usage settings loading ignores a result received after disconnection', async () => {
  const settingsModule = await loadUsageSettingsModule();
  const settingsLoad = createDeferred();
  const appliedValues = [];

  assert.equal(typeof settingsModule?.createUsageSettingsLoader, 'function');
  const loader = settingsModule.createUsageSettingsLoader({
    loadSettings: () => settingsLoad.promise,
    onResolved: (showUsage) => appliedValues.push(showUsage),
  });
  const loading = loader.load();

  loader.disconnect();
  settingsLoad.resolve({ CommandPalette: { ShowUsage: true } });
  await loading;

  assert.deepEqual(appliedValues, []);
});
