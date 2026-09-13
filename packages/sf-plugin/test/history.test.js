import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { CommandHistory } from '../lib/services/history.js';

test('history persists counts per org/user without search terms or URLs', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'navigator-history-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const scope = { directory, orgId: 'org-a', username: 'user-a' };
  const history = new CommandHistory(scope);
  assert.deepEqual(await history.read(), {});
  await history.record('home');
  await history.record('home');
  await history.record('search-records');
  assert.deepEqual(await new CommandHistory(scope).read(), { home: 2 });
  for (const different of [{ orgId: 'org-b' }, { username: 'user-b' }]) {
    assert.deepEqual(
      await new CommandHistory({ ...scope, ...different }).read(),
      {}
    );
  }
  assert.equal(await readFile(history.path, 'utf8'), '{"home":2}\n');
});

test('malformed history is ignored and invalid counts are removed', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'navigator-history-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const history = new CommandHistory({ directory, orgId: 'a', username: 'b' });
  for (const value of ['{', 'null', '[]', '1']) {
    await writeFile(history.path, value);
    assert.deepEqual(await history.read(), {});
  }
  await writeFile(
    history.path,
    JSON.stringify({ home: 2, bad: -1, string: '3', fraction: 0.5 })
  );
  assert.deepEqual(await history.read(), { home: 2 });
  await history.record('other');
  assert.deepEqual(await history.read(), { home: 2, other: 1 });
});
