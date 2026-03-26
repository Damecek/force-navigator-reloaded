import test from 'node:test';
import assert from 'node:assert/strict';

const ORG_HOSTNAME = 'acme.sandbox.lightning.force.com';
const TOKEN_STORAGE_KEY = `${ORG_HOSTNAME}_sfToken`;

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

function buildCachedToken(overrides = {}) {
  return {
    access_token: '00Dxx0000000001!AQ4AQH0_access',
    id: 'https://login.salesforce.com/id/00Dxx0000000001/005xx0000000001',
    id_token: 'id-token',
    instance_url: 'https://acme.sandbox.my.salesforce.com',
    issued_at: Date.now() - 22 * 3600 * 1000,
    refresh_token: 'refresh-token-1',
    scope: 'api refresh_token',
    signature: 'signature',
    token_type: 'Bearer',
    ...overrides,
  };
}

async function loadAuthModule() {
  return import(
    `../src/background/auth/auth.js?test=${Date.now()}-${Math.random()}`
  );
}

async function loadSharedModule() {
  return import(`../src/shared/index.js?test=${Date.now()}-${Math.random()}`);
}

test.beforeEach(() => {
  storageArea.clear();
  global.fetch = async () => {
    throw new Error('Unexpected fetch call');
  };
});

test('refreshToken preserves cached token when refresh request fails', async () => {
  const { CacheManager, SF_TOKEN_CACHE_KEY } = await loadSharedModule();
  const { refreshToken } = await loadAuthModule();
  const cache = new CacheManager(ORG_HOSTNAME);
  const cachedToken = buildCachedToken();

  await cache.set(SF_TOKEN_CACHE_KEY, cachedToken, { preserve: true });
  global.fetch = async () => ({
    ok: false,
    text: async () => 'invalid_grant',
  });

  const result = await refreshToken(ORG_HOSTNAME);
  const stored = await chrome.storage.local.get([TOKEN_STORAGE_KEY]);

  assert.equal(result, null);
  assert.deepEqual(stored[TOKEN_STORAGE_KEY]?.value, cachedToken);
});

test('refreshToken deletes cached token when refresh token is missing', async () => {
  const { CacheManager, SF_TOKEN_CACHE_KEY } = await loadSharedModule();
  const { refreshToken } = await loadAuthModule();
  const cache = new CacheManager(ORG_HOSTNAME);

  await cache.set(
    SF_TOKEN_CACHE_KEY,
    buildCachedToken({ refresh_token: undefined }),
    {
      preserve: true,
    }
  );

  const result = await refreshToken(ORG_HOSTNAME);
  const stored = await chrome.storage.local.get([TOKEN_STORAGE_KEY]);

  assert.equal(result, null);
  assert.equal(stored[TOKEN_STORAGE_KEY], undefined);
});

test('refreshToken stores rotated refresh token from Salesforce response', async () => {
  const { CacheManager, SF_TOKEN_CACHE_KEY } = await loadSharedModule();
  const { refreshToken } = await loadAuthModule();
  const cache = new CacheManager(ORG_HOSTNAME);

  await cache.set(SF_TOKEN_CACHE_KEY, buildCachedToken(), { preserve: true });
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      access_token: '00Dxx0000000001!AQ4AQH0_new_access',
      id: 'https://login.salesforce.com/id/00Dxx0000000001/005xx0000000001',
      id_token: 'new-id-token',
      instance_url: 'https://acme.sandbox.my.salesforce.com',
      refresh_token: 'refresh-token-2',
      scope: 'api refresh_token web',
      signature: 'new-signature',
      token_type: 'Bearer',
    }),
  });

  const result = await refreshToken(ORG_HOSTNAME);
  const stored = await chrome.storage.local.get([TOKEN_STORAGE_KEY]);

  assert.equal(result?.refresh_token, 'refresh-token-2');
  assert.equal(
    stored[TOKEN_STORAGE_KEY]?.value.refresh_token,
    'refresh-token-2'
  );
  assert.equal(stored[TOKEN_STORAGE_KEY]?.value.scope, 'api refresh_token web');
});

test('refreshToken keeps prior refresh token and scope when Salesforce omits them', async () => {
  const { CacheManager, SF_TOKEN_CACHE_KEY } = await loadSharedModule();
  const { refreshToken } = await loadAuthModule();
  const cache = new CacheManager(ORG_HOSTNAME);

  await cache.set(SF_TOKEN_CACHE_KEY, buildCachedToken(), { preserve: true });
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      access_token: '00Dxx0000000001!AQ4AQH0_new_access',
      id: 'https://login.salesforce.com/id/00Dxx0000000001/005xx0000000001',
      id_token: 'new-id-token',
      instance_url: 'https://acme.sandbox.my.salesforce.com',
      signature: 'new-signature',
      token_type: 'Bearer',
    }),
  });

  const result = await refreshToken(ORG_HOSTNAME);
  const stored = await chrome.storage.local.get([TOKEN_STORAGE_KEY]);

  assert.equal(result?.refresh_token, 'refresh-token-1');
  assert.equal(result?.scope, 'api refresh_token');
  assert.equal(
    stored[TOKEN_STORAGE_KEY]?.value.refresh_token,
    'refresh-token-1'
  );
  assert.equal(stored[TOKEN_STORAGE_KEY]?.value.scope, 'api refresh_token');
});

test('getCommands falls back to authorize commands and preserves token after refresh failure', async () => {
  const { CacheManager, SF_TOKEN_CACHE_KEY } = await loadSharedModule();
  const { getCommands } = await import(
    `../src/background/commandRegister.js?test=${Date.now()}-${Math.random()}`
  );
  const cache = new CacheManager(ORG_HOSTNAME);
  const cachedToken = buildCachedToken();

  await cache.set(SF_TOKEN_CACHE_KEY, cachedToken, { preserve: true });
  global.fetch = async () => ({
    ok: false,
    text: async () => 'invalid_grant',
  });

  const commands = await getCommands(ORG_HOSTNAME);
  const stored = await chrome.storage.local.get([TOKEN_STORAGE_KEY]);

  assert.deepEqual(commands, {
    AuthorizeExtensionCommand: [{}],
    ExtensionOptionsCommand: [{}],
  });
  assert.deepEqual(stored[TOKEN_STORAGE_KEY]?.value, cachedToken);
});
