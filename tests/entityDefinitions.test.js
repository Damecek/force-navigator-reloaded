import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.__CLIENT_ID__ = 'test-client-id';
global.chrome = {
  storage: {
    local: {
      async get() {
        return {};
      },
      async set() {},
      async remove() {},
    },
  },
  identity: {
    getRedirectURL() {
      return 'https://example.chromiumapp.org/oauth2';
    },
  },
};

async function loadSalesforceUtilsModule() {
  return import(
    `../src/background/salesforceUtils.js?test=${Date.now()}-${Math.random()}`
  );
}

test('fetchEntityDefinitionsFromSalesforce excludes definitions without an API name', async () => {
  const { fetchEntityDefinitionsFromSalesforce } =
    await loadSalesforceUtilsModule();
  const accountDefinition = {
    DurableId: 'Account',
    Label: 'Account',
    QualifiedApiName: 'Account',
  };
  const connection = {
    async toolingQuery() {
      return [
        {
          DurableId: 'UserLicenseMetrics',
          Label: 'User License Metrics',
          QualifiedApiName: null,
        },
        accountDefinition,
      ];
    },
  };

  const records = await fetchEntityDefinitionsFromSalesforce(connection);

  assert.deepEqual(records, [accountDefinition]);
});
