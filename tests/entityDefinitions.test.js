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

test('fetchEntityDefinitionsFromSalesforce stops at the SOQL OFFSET ceiling', async () => {
  const { fetchEntityDefinitionsFromSalesforce } =
    await loadSalesforceUtilsModule();
  const fullPage = Array.from({ length: 2000 }, (_, index) => ({
    DurableId: `Object${index}`,
    Label: `Object ${index}`,
    QualifiedApiName: `Object${index}__c`,
  }));
  const queries = [];
  const connection = {
    async toolingQuery(soql) {
      queries.push(soql);
      return fullPage;
    },
  };

  const records = await fetchEntityDefinitionsFromSalesforce(connection);

  assert.equal(queries.length, 2);
  assert.match(queries[0], /LIMIT 2000$/);
  assert.match(queries[1], /LIMIT 2000 OFFSET 2000$/);
  assert.equal(records.length, 4000);
});

test('selectSetupNodeTypes keeps only enabled known SetupNode types', async () => {
  const { selectSetupNodeTypes } = await loadSalesforceUtilsModule();

  assert.deepEqual(
    selectSetupNodeTypes({
      Setup: true,
      PersonalSettings: false,
      ServiceSetup: true,
      "Setup') OR Label LIKE ('%": true,
    }),
    ['Setup', 'ServiceSetup']
  );
  assert.deepEqual(selectSetupNodeTypes(undefined), []);
});
