import assert from 'node:assert/strict';
import test from 'node:test';
import {
  collectQueryRecords,
  createNavigatorConnection,
} from '../src/services/connection.js';

test('collectQueryRecords follows every query locator', async () => {
  const locators = [];
  const records = await collectQueryRecords(
    { done: false, records: [{ Id: '1' }], nextRecordsUrl: '/next/1' },
    async (locator) => {
      locators.push(locator);
      return { done: true, records: [{ Id: '2' }] };
    }
  );
  assert.deepEqual(records, [{ Id: '1' }, { Id: '2' }]);
  assert.deepEqual(locators, ['/next/1']);
});

test('collectQueryRecords rejects broken and repeated pagination', async () => {
  await assert.rejects(
    collectQueryRecords({ done: false, records: [] }, async () => ({})),
    /without a locator/
  );
  await assert.rejects(
    collectQueryRecords(
      { done: false, records: [], nextRecordsUrl: '/same' },
      async () => ({ done: false, records: [], nextRecordsUrl: '/same' })
    ),
    /repeated pagination locator/
  );
});

test('createNavigatorConnection pins the API and keeps query families separate', async () => {
  const calls = [];
  const connection = {
    query: async (soql) => {
      calls.push(['query', soql]);
      return { done: true, records: [{ family: 'rest' }] };
    },
    queryMore: async () => assert.fail('unexpected REST queryMore'),
    tooling: {
      query: async (soql) => {
        calls.push(['tooling', soql]);
        return { done: true, records: [{ family: 'tooling' }] };
      },
      queryMore: async () => assert.fail('unexpected Tooling queryMore'),
    },
  };
  const org = {
    getConnection: (version) => {
      assert.equal(version, '62.0');
      return connection;
    },
  };
  const adapter = createNavigatorConnection(org, '62.0');
  assert.deepEqual(await adapter.query('SELECT Id FROM User'), [
    { family: 'rest' },
  ]);
  assert.deepEqual(await adapter.toolingQuery('SELECT Id FROM ApexClass'), [
    { family: 'tooling' },
  ]);
  assert.deepEqual(calls, [
    ['query', 'SELECT Id FROM User'],
    ['tooling', 'SELECT Id FROM ApexClass'],
  ]);
});
