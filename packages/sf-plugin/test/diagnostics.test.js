import assert from 'node:assert/strict';
import test from 'node:test';
import { Diagnostics } from '../src/services/diagnostics.js';
import { createNavigatorConnection } from '../src/services/connection.js';

function recorder(enabled = true) {
  const lines = [];
  let tick = 0;
  return {
    lines,
    diagnostics: new Diagnostics({
      enabled,
      write: (line) => lines.push(line),
      now: () => tick++ * 10,
    }),
  };
}

test('diagnostics are silent by default and do not alter operation results', async () => {
  const { lines, diagnostics } = recorder(false);
  diagnostics.note('Cache: miss');
  assert.equal(await diagnostics.measure('work', async () => 42), 42);
  diagnostics.flush();
  assert.deepEqual(lines, []);
});

test('diagnostics buffer timings until flushed and do not duplicate output', async () => {
  const { lines, diagnostics } = recorder();
  diagnostics.note('Cache: hit');
  await diagnostics.measure(
    'Catalog total',
    async () => [1, 2],
    (rows) => `${rows.length} commands`
  );
  assert.deepEqual(lines, []);
  diagnostics.flush();
  diagnostics.flush();
  assert.deepEqual(lines, [
    '[debug] Cache: hit',
    '[debug] Catalog total: 10 ms, 2 commands',
  ]);
});

test('failed operations preserve errors without logging their contents', async () => {
  const { lines, diagnostics } = recorder();
  const error = new Error('https://example.invalid/?sid=secret');
  await assert.rejects(
    diagnostics.measure('Tooling User page 1', async () => {
      throw error;
    }),
    (actual) => actual === error
  );
  diagnostics.flush();
  assert.deepEqual(lines, ['[debug] Tooling User page 1: 10 ms, failed']);
});

test('Salesforce timings distinguish API, pagination, offsets and counts without raw data', async () => {
  const { lines, diagnostics } = recorder();
  const client = {
    query: async () => ({
      records: [{ Name: 'private-name' }],
      done: false,
      nextRecordsUrl: '/secret-locator',
    }),
    queryMore: async () => ({ records: [{ Id: 'private-id' }], done: true }),
  };
  const org = { getConnection: () => ({ ...client, tooling: client }) };
  const connection = createNavigatorConnection(org, '62.0', diagnostics);
  assert.equal(
    (
      await connection.query(
        "SELECT Id FROM User WHERE Name = 'private-filter'"
      )
    ).length,
    2
  );
  assert.equal(
    (
      await connection.toolingQuery(
        'SELECT Id FROM EntityDefinition LIMIT 2000 OFFSET 2000'
      )
    ).length,
    2
  );
  diagnostics.flush();
  assert.deepEqual(lines, [
    '[debug] REST User page 1: 10 ms, 1 records',
    '[debug] REST User page 2: 10 ms, 1 records',
    '[debug] Tooling EntityDefinition LIMIT 2000 OFFSET 2000 page 1: 10 ms, 1 records',
    '[debug] Tooling EntityDefinition LIMIT 2000 OFFSET 2000 page 2: 10 ms, 1 records',
  ]);
});
