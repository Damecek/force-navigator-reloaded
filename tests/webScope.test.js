import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createFakeIndexedDb,
  createStorageArea,
  createTokenEndpoint,
  jsonResponse,
} from './helpers/dpop.js';

globalThis.__CLIENT_ID__ = 'test-client-id';

const ORG = 'acme.sandbox.lightning.force.com';
const ORG_CORE = 'acme.sandbox.my.salesforce.com';
const REDIRECT = 'https://example.chromiumapp.org/oauth2';

const storageArea = createStorageArea();
globalThis.indexedDB = createFakeIndexedDb();
let authorizeUrl = null;

global.chrome = {
  storage: { local: storageArea },
  identity: {
    getRedirectURL() {
      return REDIRECT;
    },
    async launchWebAuthFlow({ url }) {
      authorizeUrl = new URL(url);
      return `${REDIRECT}?code=auth-code`;
    },
  },
};

// The same module instance that auth.js and commandRegister.js read settings from.
const shared = await import('../src/shared/index.js');
const { getCommands } = await import('../src/background/commandRegister.js');
const { ensureWebScopedToken, interactiveLogin } =
  await import('../src/background/auth/auth.js');

const settingsWith = ({ autoLogin, loginAs }) =>
  shared.saveSettings({
    AutoLogin: autoLogin,
    Commands: { LoginAs: loginAs, ExperienceSite: false },
  });

async function requestedScope() {
  const endpoint = createTokenEndpoint(() =>
    jsonResponse(200, {
      access_token: '00Dxx0000000001!access',
      refresh_token: 'refresh',
      instance_url: `https://${ORG_CORE}`,
      scope: 'refresh_token api',
      token_type: 'DPoP',
    })
  );
  global.fetch = (url, init) => endpoint.handle(String(url), init);
  await interactiveLogin(ORG);
  return authorizeUrl.searchParams.get('scope');
}

async function commandsForGrant(scope) {
  const cache = new shared.CacheManager(ORG);
  await cache.set(
    shared.SF_TOKEN_CACHE_KEY,
    {
      access_token: '00Dxx0000000001!access',
      instance_url: `https://${ORG_CORE}`,
      issued_at: Date.now(),
      scope,
    },
    { preserve: true }
  );
  await Promise.all(
    [
      shared.APEX_CLASS_CACHE_KEY,
      shared.APEX_TRIGGER_CACHE_KEY,
      shared.ENTITY_CACHE_KEY,
      shared.FLOW_CACHE_KEY,
      shared.LIGHTNING_APP_CACHE_KEY,
      shared.LOGIN_AS_CACHE_KEY,
      shared.MENU_CACHE_KEY,
      shared.PERMISSION_SET_CACHE_KEY,
      shared.USER_CACHE_KEY,
    ].map((key) => cache.set(key, []))
  );
  return getCommands(ORG);
}

test.beforeEach(() => {
  storageArea.records.clear();
  globalThis.indexedDB.clear();
  authorizeUrl = null;
  global.fetch = async () => {
    throw new Error('Unexpected fetch call');
  };
});

test('the default settings need the web scope because Login As is on', async () => {
  await shared.resetSettings();

  assert.equal(await shared.isWebScopeRequired(), true);
  assert.equal(await requestedScope(), 'web api refresh_token');
});

test('each feature that starts a UI session needs the web scope on its own', async () => {
  await settingsWith({ autoLogin: true, loginAs: false });
  assert.equal(await shared.isWebScopeRequired(), true);
  assert.equal(await requestedScope(), 'web api refresh_token');

  await settingsWith({ autoLogin: false, loginAs: true });
  assert.equal(await shared.isWebScopeRequired(), true);
  assert.equal(await requestedScope(), 'web api refresh_token');
});

test('authorization does not request the web scope when no feature needs it', async () => {
  await settingsWith({ autoLogin: false, loginAs: false });

  assert.equal(await shared.isWebScopeRequired(), false);
  assert.equal(await requestedScope(), 'api refresh_token');
});

test('the palette offers authorization for a grant without the web scope while Login As is on', async () => {
  await settingsWith({ autoLogin: false, loginAs: true });

  const commands = await commandsForGrant('api refresh_token');

  assert.deepEqual(commands.AuthorizeExtensionCommand, [{}]);
  assert.ok(commands.NavigationCommand.length > 0);
});

test('the palette does not offer authorization when the grant has the web scope', async () => {
  await settingsWith({ autoLogin: false, loginAs: true });

  const commands = await commandsForGrant('refresh_token web api');

  assert.equal('AuthorizeExtensionCommand' in commands, false);
});

test('the palette does not offer authorization when no enabled feature needs the web scope', async () => {
  await settingsWith({ autoLogin: false, loginAs: false });

  const commands = await commandsForGrant('api refresh_token');

  assert.equal('AuthorizeExtensionCommand' in commands, false);
});

test('settings saved from another context apply to the next authorization', async () => {
  await shared.resetSettings();
  assert.equal(await shared.isWebScopeRequired(), true);

  // A separate module instance has its own settings cache, like the options page.
  const optionsPage = await import('../src/shared/settings.js?context=options');
  await optionsPage.saveSettings({
    AutoLogin: false,
    Commands: { LoginAs: false },
  });

  assert.equal(await shared.isWebScopeRequired(), false);
  assert.equal(await requestedScope(), 'api refresh_token');
});

test('auto-login does not use a grant with the web scope while its setting is off', async () => {
  await settingsWith({ autoLogin: false, loginAs: true });
  const cache = new shared.CacheManager(ORG);
  const grant = {
    access_token: '00Dxx0000000001!access',
    refresh_token: 'refresh',
    instance_url: `https://${ORG_CORE}`,
    issued_at: Date.now(),
    scope: 'refresh_token web api',
  };
  await cache.set(shared.SF_TOKEN_CACHE_KEY, grant, { preserve: true });
  let requests = 0;
  global.fetch = async () => {
    requests += 1;
    throw new Error('Unexpected fetch call');
  };

  assert.equal(await ensureWebScopedToken(ORG), null);
  assert.equal(requests, 0);
  assert.deepEqual(await cache.get(shared.SF_TOKEN_CACHE_KEY), grant);
});

test('an authorization check racing a settings save does not overwrite the save', async () => {
  const readFromStorage = storageArea.get;
  let finishRead;
  const paused = new Promise((resolve) => {
    finishRead = resolve;
  });
  storageArea.get = async (keys) => {
    storageArea.get = readFromStorage;
    const snapshot = await readFromStorage(keys);
    await paused;
    return snapshot;
  };
  const check = shared.isWebScopeRequired();
  const optionsPage = await import('../src/shared/settings.js?context=race');
  await optionsPage.saveSettings({
    AutoLogin: false,
    Commands: { LoginAs: false },
  });
  finishRead();

  assert.equal(await check, true);
  assert.equal(await shared.isWebScopeRequired(), false);
});
