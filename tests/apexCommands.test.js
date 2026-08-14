import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.__CLIENT_ID__ = 'test-client-id';
const storageRecords = new Map();
global.chrome = {
  storage: {
    local: {
      async get(keys) {
        if (typeof keys === 'undefined') {
          return Object.fromEntries(storageRecords);
        }
        const requestedKeys = Array.isArray(keys) ? keys : [keys];
        return Object.fromEntries(
          requestedKeys
            .filter((key) => storageRecords.has(key))
            .map((key) => [key, storageRecords.get(key)])
        );
      },
      async set(values) {
        for (const [key, value] of Object.entries(values)) {
          storageRecords.set(key, value);
        }
      },
      async remove(keys) {
        for (const key of keys) {
          storageRecords.delete(key);
        }
      },
    },
  },
  identity: {
    getRedirectURL() {
      return 'https://example.chromiumapp.org/oauth2';
    },
  },
};

async function loadApexCommandsModule() {
  return import(
    `../src/background/commandSources/apexCommands.js?test=${Date.now()}-${Math.random()}`
  ).catch(() => ({}));
}

async function loadSalesforceUtilsModule() {
  return import(
    `../src/background/salesforceUtils.js?test=${Date.now()}-${Math.random()}`
  );
}

async function loadSharedModule() {
  return import(`../src/shared/index.js?test=${Date.now()}-${Math.random()}`);
}

test.beforeEach(() => {
  storageRecords.clear();
});

test('buildApexClassCommands returns Setup navigation descriptors', async () => {
  const { buildApexClassCommands } = await loadApexCommandsModule();
  assert.equal(typeof buildApexClassCommands, 'function');

  assert.deepEqual(
    buildApexClassCommands([
      {
        Id: '01pxx0000000001AAA',
        Name: 'AccountService',
        NamespacePrefix: null,
      },
    ]),
    [
      {
        id: 'apex-class-01pxx0000000001AAA',
        label: 'Apex Class > AccountService',
        path: '/lightning/setup/ApexClasses/page?address=%2F01pxx0000000001AAA',
      },
    ]
  );
});

test('buildApexTriggerCommands returns Setup navigation descriptors', async () => {
  const { buildApexTriggerCommands } = await loadApexCommandsModule();
  assert.equal(typeof buildApexTriggerCommands, 'function');

  assert.deepEqual(
    buildApexTriggerCommands([
      {
        Id: '01qxx0000000001AAA',
        Name: 'AccountTrigger',
        NamespacePrefix: null,
      },
    ]),
    [
      {
        id: 'apex-trigger-01qxx0000000001AAA',
        label: 'Apex Trigger > AccountTrigger',
        path: '/lightning/setup/ApexTriggers/page?address=%2F01qxx0000000001AAA',
      },
    ]
  );
});

test('Apex command builders return no commands for empty org metadata', async () => {
  const { buildApexClassCommands, buildApexTriggerCommands } =
    await loadApexCommandsModule();
  assert.equal(typeof buildApexClassCommands, 'function');
  assert.equal(typeof buildApexTriggerCommands, 'function');

  assert.deepEqual(buildApexClassCommands([]), []);
  assert.deepEqual(buildApexTriggerCommands([]), []);
});

test('fetchApexClassesFromSalesforce uses minimal unmanaged-only Tooling SOQL', async () => {
  const { fetchApexClassesFromSalesforce } = await loadSalesforceUtilsModule();
  assert.equal(typeof fetchApexClassesFromSalesforce, 'function');
  let receivedSoql;
  const expectedRecords = [
    { Id: '01pxx0000000001AAA', Name: 'AccountService' },
  ];
  const connection = {
    async toolingQuery(soql) {
      receivedSoql = soql;
      return expectedRecords;
    },
  };

  const records = await fetchApexClassesFromSalesforce(connection);

  assert.equal(
    receivedSoql,
    "SELECT Id, Name, NamespacePrefix FROM ApexClass WHERE ManageableState = 'unmanaged'"
  );
  assert.deepEqual(records, expectedRecords);
});

test('fetchApexTriggersFromSalesforce uses minimal unmanaged-only Tooling SOQL', async () => {
  const { fetchApexTriggersFromSalesforce } = await loadSalesforceUtilsModule();
  assert.equal(typeof fetchApexTriggersFromSalesforce, 'function');
  let receivedSoql;
  const expectedRecords = [
    { Id: '01qxx0000000001AAA', Name: 'AccountTrigger' },
  ];
  const connection = {
    async toolingQuery(soql) {
      receivedSoql = soql;
      return expectedRecords;
    },
  };

  const records = await fetchApexTriggersFromSalesforce(connection);

  assert.equal(
    receivedSoql,
    "SELECT Id, Name, NamespacePrefix FROM ApexTrigger WHERE ManageableState = 'unmanaged'"
  );
  assert.deepEqual(records, expectedRecords);
});

test('Apex classes and triggers have independent enabled settings and caches', async () => {
  const {
    APEX_CLASS_CACHE_KEY,
    APEX_CLASS_CACHE_TTL,
    APEX_CLASS_SETTINGS_KEY,
    APEX_TRIGGER_CACHE_KEY,
    APEX_TRIGGER_CACHE_TTL,
    APEX_TRIGGER_SETTINGS_KEY,
    COMMAND_CACHE_KEYS,
    COMMANDS_SETTINGS_KEY,
    DEFAULT_SETTINGS,
  } = await loadSharedModule();

  assert.equal(APEX_CLASS_SETTINGS_KEY, 'ApexClass');
  assert.equal(APEX_TRIGGER_SETTINGS_KEY, 'ApexTrigger');
  assert.equal(
    DEFAULT_SETTINGS[COMMANDS_SETTINGS_KEY][APEX_CLASS_SETTINGS_KEY],
    true
  );
  assert.equal(
    DEFAULT_SETTINGS[COMMANDS_SETTINGS_KEY][APEX_TRIGGER_SETTINGS_KEY],
    true
  );
  assert.equal(APEX_CLASS_CACHE_KEY, 'apexClasses');
  assert.equal(APEX_TRIGGER_CACHE_KEY, 'apexTriggers');
  assert.equal(APEX_CLASS_CACHE_TTL, 3600 * 1000 * 6);
  assert.equal(APEX_TRIGGER_CACHE_TTL, 3600 * 1000 * 6);
  assert.equal(COMMAND_CACHE_KEYS.includes(APEX_CLASS_CACHE_KEY), true);
  assert.equal(COMMAND_CACHE_KEYS.includes(APEX_TRIGGER_CACHE_KEY), true);
  assert.notEqual(APEX_CLASS_CACHE_KEY, APEX_TRIGGER_CACHE_KEY);
});

test('getCommands includes independently fetched Apex class and trigger commands', async () => {
  const {
    CacheManager,
    ENTITY_CACHE_KEY,
    EXPERIENCE_SITE_CACHE_KEY,
    FLOW_CACHE_KEY,
    LIGHTNING_APP_CACHE_KEY,
    LOGIN_AS_CACHE_KEY,
    MENU_CACHE_KEY,
    PERMISSION_SET_CACHE_KEY,
    SF_TOKEN_CACHE_KEY,
    USER_CACHE_KEY,
  } = await loadSharedModule();
  const hostname = 'acme.sandbox.lightning.force.com';
  const cache = new CacheManager(hostname);
  await cache.set(
    SF_TOKEN_CACHE_KEY,
    {
      access_token: 'test-access-token',
      instance_url: 'https://acme.sandbox.my.salesforce.com',
      issued_at: Date.now(),
      scope: 'api refresh_token',
    },
    { preserve: true }
  );
  await Promise.all(
    [
      ENTITY_CACHE_KEY,
      EXPERIENCE_SITE_CACHE_KEY,
      FLOW_CACHE_KEY,
      LIGHTNING_APP_CACHE_KEY,
      LOGIN_AS_CACHE_KEY,
      MENU_CACHE_KEY,
      PERMISSION_SET_CACHE_KEY,
      USER_CACHE_KEY,
    ].map((key) => cache.set(key, []))
  );
  global.fetch = async (url) => {
    const query = decodeURIComponent(new URL(url).searchParams.get('q'));
    if (query.includes('FROM ApexClass')) {
      return {
        ok: true,
        async json() {
          return {
            records: [{ Id: '01pxx0000000001AAA', Name: 'AccountService' }],
          };
        },
      };
    }
    if (query.includes('FROM ApexTrigger')) {
      return {
        ok: true,
        async json() {
          return {
            records: [{ Id: '01qxx0000000001AAA', Name: 'AccountTrigger' }],
          };
        },
      };
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  const { getCommands } = await import(
    `../src/background/commandRegister.js?test=${Date.now()}-${Math.random()}`
  );

  const { NavigationCommand } = await getCommands(hostname);

  assert.equal(
    NavigationCommand.some(
      ({ id, label }) =>
        id === 'apex-class-01pxx0000000001AAA' &&
        label === 'Apex Class > AccountService'
    ),
    true
  );
  assert.equal(
    NavigationCommand.some(
      ({ id, label }) =>
        id === 'apex-trigger-01qxx0000000001AAA' &&
        label === 'Apex Trigger > AccountTrigger'
    ),
    true
  );
});
