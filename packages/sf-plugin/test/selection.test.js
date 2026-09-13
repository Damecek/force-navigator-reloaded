import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import { searchCatalog } from '../lib/services/catalog.js';
import { isCancelKey, selectCommand } from '../lib/services/selection.js';

const commands = [
  { id: 'deploy-status', label: 'Deploy > Deployment Status', source: 'setup' },
  {
    id: 'deploy-settings',
    label: 'Deploy > Deployment Settings',
    source: 'setup',
  },
  { id: 'app-home', label: 'Home', source: 'static' },
];

const KEY = { enter: '\r', down: '\x1b[B', up: '\x1b[A', escape: '\x1b' };

async function drive(keys, options = {}) {
  const input = new PassThrough();
  const output = new PassThrough();
  let rendered = '';
  output.on('data', (chunk) => {
    rendered += chunk.toString();
  });
  const pending = selectCommand({ commands, ...options }, { input, output });
  for (const key of keys) {
    await new Promise((resolve) => setTimeout(resolve, 15));
    input.write(key);
  }
  const result = await pending;
  return { result, rendered };
}

test('selectCommand returns the top match for the initial term on Enter', async () => {
  const { result, rendered } = await drive([KEY.enter], {
    initialTerm: 'deploy stat',
  });
  assert.equal(result.id, 'deploy-status');
  assert.ok(rendered.includes('Deployment Status'));
});

test('selectCommand re-ranks while typing and moves with arrow keys', async () => {
  const ranked = searchCatalog(commands, 'depl');
  assert.equal(ranked.length, 2);
  const { result } = await drive(['d', 'e', 'p', 'l', KEY.down, KEY.enter]);
  assert.equal(result.id, ranked[1].id);
});

test('selectCommand keeps the typed term after arrow keys and resets the cursor on edits', async () => {
  const { result, rendered } = await drive([
    'd',
    'e',
    'p',
    KEY.down,
    'l',
    KEY.enter,
  ]);
  assert.equal(result.id, searchCatalog(commands, 'depl')[0].id);
  assert.ok(rendered.includes('depl'));
});

test('selectCommand returns null when Escape cancels', async () => {
  const { result, rendered } = await drive([KEY.escape], {
    initialTerm: 'home',
  });
  assert.equal(result, null);
  assert.ok(rendered.includes('cancelled'));
});

test('selectCommand treats q on an empty line as cancel but as text otherwise', async () => {
  assert.equal(isCancelKey({ name: 'q' }, ''), true);
  assert.equal(isCancelKey({ name: 'q' }, 'de'), false);
  assert.equal(isCancelKey({ name: 'escape' }, 'de'), true);
});
