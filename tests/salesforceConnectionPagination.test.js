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

const INSTANCE_URL = 'https://acme.sandbox.my.salesforce.com';

async function loadConnection() {
  const { SalesforceConnection } = await import(
    `../src/background/salesforceConnection.js?test=${Date.now()}-${Math.random()}`
  );
  return new SalesforceConnection({
    instanceUrl: INSTANCE_URL,
    accessToken: 'test-access-token',
  });
}

function mockPaginatedFetch(firstRecords, secondRecords, nextRecordsUrl) {
  const requestedUrls = [];
  global.fetch = async (url) => {
    requestedUrls.push(url);
    const response =
      requestedUrls.length === 1
        ? { records: firstRecords, nextRecordsUrl }
        : { records: secondRecords };
    return {
      ok: true,
      async json() {
        return response;
      },
    };
  };
  return requestedUrls;
}

test('query resolves a root-relative nextRecordsUrl against the instance origin', async () => {
  const nextRecordsUrl = '/services/data/v62.0/query/01gxx0000000001-2000';
  const requestedUrls = mockPaginatedFetch(
    [{ Id: '01pxx0000000001' }],
    [{ Id: '01pxx0000000002' }],
    nextRecordsUrl
  );
  const connection = await loadConnection();

  const records = await connection.query('SELECT Id FROM ApexClass');

  assert.deepEqual(records, [
    { Id: '01pxx0000000001' },
    { Id: '01pxx0000000002' },
  ]);
  assert.deepEqual(requestedUrls, [
    `${INSTANCE_URL}/services/data/v62.0/query/?q=SELECT%20Id%20FROM%20ApexClass`,
    `${INSTANCE_URL}${nextRecordsUrl}`,
  ]);
});

test('toolingQuery resolves a root-relative nextRecordsUrl and aggregates all records', async () => {
  const nextRecordsUrl =
    '/services/data/v62.0/tooling/query/01gxx0000000002-2000';
  const requestedUrls = mockPaginatedFetch(
    [{ Id: '01qxx0000000001' }],
    [{ Id: '01qxx0000000002' }],
    nextRecordsUrl
  );
  const connection = await loadConnection();

  const records = await connection.toolingQuery('SELECT Id FROM ApexTrigger');

  assert.deepEqual(records, [
    { Id: '01qxx0000000001' },
    { Id: '01qxx0000000002' },
  ]);
  assert.deepEqual(requestedUrls, [
    `${INSTANCE_URL}/services/data/v62.0/tooling/query/?q=SELECT%20Id%20FROM%20ApexTrigger`,
    `${INSTANCE_URL}${nextRecordsUrl}`,
  ]);
});
