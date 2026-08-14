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

async function loadExperienceSiteCommandsModule() {
  return import(
    `../src/background/commandSources/experienceSiteCommands.js?test=${Date.now()}-${Math.random()}`
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

test('buildExperienceSiteCommands adds Workspace and matched Builder commands with 15-character IDs', async () => {
  const { buildExperienceSiteCommands } =
    await loadExperienceSiteCommandsModule();
  assert.equal(typeof buildExperienceSiteCommands, 'function');

  assert.deepEqual(
    buildExperienceSiteCommands(
      [
        {
          Id: '0DB5g000000AbCdEAK',
          Name: 'Partner Hub',
          Status: 'Live',
        },
      ],
      [{ Id: '0DM5g000000EfGhIAK', MasterLabel: 'Partner Hub' }]
    ),
    [
      {
        id: 'experience-site-workspace-0DB5g000000AbCd',
        label: 'Experience Cloud > Partner Hub > Workspace',
        path: '/servlet/networks/switch?networkId=0DB5g000000AbCd&startURL=%2FcommunitySetup%2FcwApp.app%23%2Fc%2Fhome&',
        host: 'core',
      },
      {
        id: 'experience-site-builder-0DM5g000000EfGh',
        label: 'Experience Cloud > Partner Hub > Builder',
        path: '/sfsites/picasso/core/config/commeditor.jsp?exitURL=%2Fservlet%2Fnetworks%2Fswitch%3FnetworkId%3D0DB5g000000AbCd%26startURL%3D%252FcommunitySetup%252FcwApp.app%2523%252Fc%252Fhome%26&siteId=0DM5g000000EfGh&',
        host: 'core',
      },
    ]
  );
});

test('buildExperienceSiteCommands keeps every Network and omits only unmatched Builders', async () => {
  const { buildExperienceSiteCommands } =
    await loadExperienceSiteCommandsModule();
  assert.equal(typeof buildExperienceSiteCommands, 'function');

  const commands = buildExperienceSiteCommands(
    [
      {
        Id: '0DB5g000000ObriEAK',
        Name: "O'Brien Portal",
        Status: 'UnderConstruction',
      },
      {
        Id: '0DB5g000000NoSiEAK',
        Name: 'Workspace Only',
        Status: 'Inactive',
      },
    ],
    [{ Id: '0DM5g000000ObriIAK', MasterLabel: "O'Brien Portal" }]
  );

  assert.deepEqual(
    commands.map(({ label }) => label),
    [
      "Experience Cloud > O'Brien Portal > Workspace",
      "Experience Cloud > O'Brien Portal > Builder",
      'Experience Cloud > Workspace Only > Workspace',
    ]
  );
  assert.equal(
    commands.some(({ path }) => path.includes('0DB5g000000ObriEAK')),
    false
  );
  assert.equal(
    commands.some(({ path }) => path.includes('0DM5g000000ObriIAK')),
    false
  );
});

test('buildExperienceSiteCommands returns no commands when the org has no Networks', async () => {
  const { buildExperienceSiteCommands } =
    await loadExperienceSiteCommandsModule();
  assert.equal(typeof buildExperienceSiteCommands, 'function');

  assert.deepEqual(
    buildExperienceSiteCommands(
      [],
      [{ Id: '0DM5g000000EfGhIAK', MasterLabel: 'Orphan Site' }]
    ),
    []
  );
});

test('Experience Cloud fetchers use two fixed standard-object SOQL queries', async () => {
  const { fetchExperienceSitesFromSalesforce, fetchNetworksFromSalesforce } =
    await loadSalesforceUtilsModule();
  assert.equal(typeof fetchNetworksFromSalesforce, 'function');
  assert.equal(typeof fetchExperienceSitesFromSalesforce, 'function');
  const receivedSoql = [];
  const connection = {
    async query(soql) {
      receivedSoql.push(soql);
      return [];
    },
  };

  await fetchNetworksFromSalesforce(connection);
  await fetchExperienceSitesFromSalesforce(connection);

  assert.deepEqual(receivedSoql, [
    'SELECT Id, Name, Status FROM Network',
    "SELECT Id, MasterLabel FROM Site WHERE SiteType = 'ChatterNetworkPicasso'",
  ]);
  assert.equal(
    receivedSoql.some((soql) => soql.includes("O'Brien")),
    false
  );
});

test('Experience Cloud commands are enabled by default and use one registered six-hour cache', async () => {
  const {
    COMMAND_CACHE_KEYS,
    COMMANDS_SETTINGS_KEY,
    DEFAULT_SETTINGS,
    EXPERIENCE_SITE_CACHE_KEY,
    EXPERIENCE_SITE_CACHE_TTL,
    EXPERIENCE_SITE_SETTINGS_KEY,
  } = await loadSharedModule();

  assert.equal(EXPERIENCE_SITE_SETTINGS_KEY, 'ExperienceSite');
  assert.equal(
    DEFAULT_SETTINGS[COMMANDS_SETTINGS_KEY][EXPERIENCE_SITE_SETTINGS_KEY],
    true
  );
  assert.equal(EXPERIENCE_SITE_CACHE_KEY, 'experienceSites');
  assert.equal(EXPERIENCE_SITE_CACHE_TTL, 3600 * 1000 * 6);
  assert.equal(
    COMMAND_CACHE_KEYS.filter((key) => key === EXPERIENCE_SITE_CACHE_KEY)
      .length,
    1
  );
});

test('getCommands fetches and includes Experience Cloud commands in the navigation pipeline', async () => {
  const {
    APEX_CLASS_CACHE_KEY,
    APEX_TRIGGER_CACHE_KEY,
    CacheManager,
    ENTITY_CACHE_KEY,
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
      APEX_CLASS_CACHE_KEY,
      APEX_TRIGGER_CACHE_KEY,
      ENTITY_CACHE_KEY,
      FLOW_CACHE_KEY,
      LIGHTNING_APP_CACHE_KEY,
      LOGIN_AS_CACHE_KEY,
      MENU_CACHE_KEY,
      PERMISSION_SET_CACHE_KEY,
      USER_CACHE_KEY,
    ].map((key) => cache.set(key, []))
  );
  const receivedSoql = [];
  global.fetch = async (url) => {
    const query = decodeURIComponent(new URL(url).searchParams.get('q'));
    receivedSoql.push(query);
    const records = query.includes('FROM Network')
      ? [{ Id: '0DB5g000000AbCdEAK', Name: 'Partner Hub', Status: 'Live' }]
      : [{ Id: '0DM5g000000EfGhIAK', MasterLabel: 'Partner Hub' }];
    return {
      ok: true,
      async json() {
        return { records };
      },
    };
  };
  const { getCommands } = await import(
    `../src/background/commandRegister.js?test=${Date.now()}-${Math.random()}`
  );

  const { NavigationCommand } = await getCommands(hostname);

  assert.deepEqual(receivedSoql.sort(), [
    "SELECT Id, MasterLabel FROM Site WHERE SiteType = 'ChatterNetworkPicasso'",
    'SELECT Id, Name, Status FROM Network',
  ]);
  assert.equal(
    NavigationCommand.some(
      ({ id, host }) =>
        id === 'experience-site-workspace-0DB5g000000AbCd' && host === 'core'
    ),
    true
  );
  assert.equal(
    NavigationCommand.some(
      ({ id, host }) =>
        id === 'experience-site-builder-0DM5g000000EfGh' && host === 'core'
    ),
    true
  );
});

test('getCommands skips Experience Cloud queries when the source is disabled', async () => {
  const {
    APEX_CLASS_CACHE_KEY,
    APEX_TRIGGER_CACHE_KEY,
    CacheManager,
    ENTITY_CACHE_KEY,
    FLOW_CACHE_KEY,
    LIGHTNING_APP_CACHE_KEY,
    LOGIN_AS_CACHE_KEY,
    MENU_CACHE_KEY,
    PERMISSION_SET_CACHE_KEY,
    saveSettings,
    SF_TOKEN_CACHE_KEY,
    USER_CACHE_KEY,
  } = await loadSharedModule();
  await saveSettings({ Commands: { ExperienceSite: false } });
  const hostname = 'disabled.sandbox.lightning.force.com';
  const cache = new CacheManager(hostname);
  await cache.set(
    SF_TOKEN_CACHE_KEY,
    {
      access_token: 'test-access-token',
      instance_url: 'https://disabled.sandbox.my.salesforce.com',
      issued_at: Date.now(),
      scope: 'api refresh_token',
    },
    { preserve: true }
  );
  await Promise.all(
    [
      APEX_CLASS_CACHE_KEY,
      APEX_TRIGGER_CACHE_KEY,
      ENTITY_CACHE_KEY,
      FLOW_CACHE_KEY,
      LIGHTNING_APP_CACHE_KEY,
      LOGIN_AS_CACHE_KEY,
      MENU_CACHE_KEY,
      PERMISSION_SET_CACHE_KEY,
      USER_CACHE_KEY,
    ].map((key) => cache.set(key, []))
  );
  let fetchCount = 0;
  global.fetch = async () => {
    fetchCount += 1;
    return {
      ok: true,
      async json() {
        return {
          records: [
            { Id: '0DB5g000000AbCdEAK', Name: 'Partner Hub', Status: 'Live' },
          ],
        };
      },
    };
  };
  const { getCommands } = await import(
    `../src/background/commandRegister.js?test=${Date.now()}-${Math.random()}`
  );

  const { NavigationCommand } = await getCommands(hostname);

  assert.equal(fetchCount, 0);
  assert.equal(
    NavigationCommand.some(({ id }) => id.startsWith('experience-site-')),
    false
  );
});
