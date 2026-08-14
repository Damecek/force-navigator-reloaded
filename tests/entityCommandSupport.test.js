import test from 'node:test';
import assert from 'node:assert/strict';
import { supportsNewRecordNavigation } from '../src/background/entityCommandSupport.js';

test('rejects the unsupported FlowInterview entity', () => {
  assert.equal(
    supportsNewRecordNavigation({
      QualifiedApiName: 'FlowInterview',
      IsEverCreatable: true,
      IsCompactLayoutable: true,
    }),
    false
  );
});

test('accepts an Account with both new-record capability flags', () => {
  assert.equal(
    supportsNewRecordNavigation({
      QualifiedApiName: 'Account',
      IsEverCreatable: true,
      IsCompactLayoutable: true,
    }),
    true
  );
});

test('rejects an entity that is not ever creatable', () => {
  assert.equal(
    supportsNewRecordNavigation({
      QualifiedApiName: 'Account',
      IsEverCreatable: false,
      IsCompactLayoutable: true,
    }),
    false
  );
});

test('rejects an entity that is not compact layoutable', () => {
  assert.equal(
    supportsNewRecordNavigation({
      QualifiedApiName: 'Account',
      IsEverCreatable: true,
      IsCompactLayoutable: false,
    }),
    false
  );
});
