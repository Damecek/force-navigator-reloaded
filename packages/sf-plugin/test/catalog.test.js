import assert from 'node:assert/strict';
import test from 'node:test';
import {
  didAllSourcesFail,
  resolveCommands,
  searchCatalog,
} from '../lib/services/catalog.js';

const commands = [
  {
    id: 'account-fields',
    label: 'Object Manager > Account > Fields & Relationships',
  },
  { id: 'flow', label: 'Process Automation > Customer Onboarding Flow' },
  { id: 'permissions', label: 'Users > Permission Sets > Sales Česko' },
];

test('searchCatalog preserves shared fuzzy ranking and strips render ranges', () => {
  const matches = searchCatalog(commands, 'acc fields');
  assert.equal(matches[0].id, 'account-fields');
  assert.equal('matchRanges' in matches[0], false);
  assert.equal(searchCatalog(commands, 'cesko')[0].id, 'permissions');
  assert.equal(
    searchCatalog(commands, 'acocunt fields')[0].id,
    'account-fields'
  );
});

test('resolveCommands uses exact IDs when supplied', () => {
  assert.deepEqual(
    resolveCommands({ commands, id: 'flow', query: 'ignored' }),
    [commands[1]]
  );
  assert.deepEqual(resolveCommands({ commands, id: 'missing' }), []);
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
