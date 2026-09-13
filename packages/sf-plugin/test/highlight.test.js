import assert from 'node:assert/strict';
import test from 'node:test';
import { highlightMatches } from '../src/services/highlight.js';

const mark = (text) => `[${text}]`;

test('highlightMatches wraps exclusive-end ranges and skips malformed ones', () => {
  assert.equal(
    highlightMatches(
      'Deployment Status',
      [
        { start: 0, end: 6 },
        { start: 11, end: 15 },
      ],
      mark
    ),
    '[Deploy]ment [Stat]us'
  );
  assert.equal(
    highlightMatches(
      'Home',
      [{ start: 2, end: 1 }, null, { start: 'x' }],
      mark
    ),
    'Home'
  );
  assert.equal(highlightMatches('Home', undefined, mark), 'Home');
  assert.equal(
    highlightMatches('Home', [{ start: 0, end: 99 }], mark),
    '[Home]'
  );
});
