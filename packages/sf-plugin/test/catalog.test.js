import assert from 'node:assert/strict';
import test from 'node:test';
import { didAllSourcesFail, searchCatalog } from '../lib/services/catalog.js';

const commands = [
  {
    id: 'account-fields',
    label: 'Object Manager > Account > Fields & Relationships',
  },
  { id: 'flow', label: 'Process Automation > Customer Onboarding Flow' },
  { id: 'permissions', label: 'Users > Permission Sets > Sales Česko' },
];

test('searchCatalog preserves shared fuzzy matching and exposes render ranges', () => {
  const matches = searchCatalog(commands, 'acc fields');
  assert.equal(matches[0].id, 'account-fields');
  assert.ok(Array.isArray(matches[0].matchRanges));
  assert.ok(matches[0].matchRanges.length > 0);
  assert.equal(searchCatalog(commands, 'cesko')[0].id, 'permissions');
  assert.equal(
    searchCatalog(commands, 'acocunt fields')[0].id,
    'account-fields'
  );
});

test('searchCatalog sorts by usage then label for empty and filtered input', () => {
  const catalog = [
    { id: 'z', label: 'Flow Zebra', usage: 2 },
    { id: 'b', label: 'Flow Beta' },
    { id: 'a', label: 'Flow Alpha' },
  ];
  for (const query of ['', 'flow']) {
    assert.deepEqual(
      searchCatalog(catalog, query).map(({ id }) => id),
      ['z', 'a', 'b']
    );
  }
});

test('searchCatalog treats ? as global record search and requires a term', () => {
  assert.deepEqual(searchCatalog(commands, '? '), []);
  const [command] = searchCatalog(commands, '  ? Acme');
  assert.equal(command.id, 'search-records');
  assert.equal(command.label, 'Search > Acme');
  assert.ok(command.path.startsWith('/one/one.app#'));
});

test('didAllSourcesFail distinguishes failed sources from successful empty sources', () => {
  assert.equal(
    didAllSourcesFail({
      sources: ['objects'],
      errors: [{ source: 'objects', message: 'denied' }],
    }),
    true
  );
  assert.equal(
    didAllSourcesFail({
      sources: ['objects', 'flows'],
      errors: [{ source: 'objects', message: 'denied' }],
    }),
    false
  );
  assert.equal(didAllSourcesFail({ sources: ['objects'], errors: [] }), false);
});
