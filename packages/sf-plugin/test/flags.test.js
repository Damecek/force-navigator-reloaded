import assert from 'node:assert/strict';
import test from 'node:test';
import { selectedSources } from '../lib/flags.js';
import { SOURCE_NAMES } from '../lib/core/index.js';

test('source flags default to every supported family', () => {
  assert.deepEqual(selectedSources({}), SOURCE_NAMES);
});

test('exclusions remove families from all sources or an explicit selection', () => {
  assert.deepEqual(
    selectedSources({ 'exclude-source': ['users', 'users', 'flows'] }),
    SOURCE_NAMES.filter((source) => !['users', 'flows'].includes(source))
  );
  assert.deepEqual(
    selectedSources({
      source: ['flows', 'users', 'flows'],
      'exclude-source': ['users'],
    }),
    ['flows']
  );
  assert.deepEqual(
    selectedSources({ source: ['flows'], 'exclude-source': ['flows'] }),
    []
  );
});
