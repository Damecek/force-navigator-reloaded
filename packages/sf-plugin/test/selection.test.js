import assert from 'node:assert/strict';
import { after } from 'node:test';
import { PassThrough } from 'node:stream';
import { stripVTControlCharacters } from 'node:util';
import test from 'node:test';
import { searchCatalog } from '../lib/services/catalog.js';
import { selectCommand } from '../lib/services/selection.js';

const previousTerm = process.env.TERM;
process.env.TERM = 'xterm-256color';
after(() => {
  if (previousTerm === undefined) delete process.env.TERM;
  else process.env.TERM = previousTerm;
});

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
  output.columns = 80;
  let rendered = '';
  output.on('data', (chunk) => {
    rendered += chunk.toString();
  });
  const pending = selectCommand(
    { commands, ...options },
    { input, output, signal: AbortSignal.timeout(3000) }
  );
  for (const key of keys) {
    await new Promise((resolve) => setTimeout(resolve, 15));
    if (typeof key === 'number') {
      output.columns = key;
      output.emit('resize');
    } else {
      input.write(key);
    }
  }
  const result = await pending;
  return { result, rendered, resizeListeners: output.listenerCount('resize') };
}

test('selectCommand renders column headers and adapts to terminal resize', async () => {
  const { result, rendered, resizeListeners } = await drive([40, KEY.enter], {
    initialTerm: 'deploy stat',
  });
  assert.equal(result.id, 'deploy-status');
  const text = stripVTControlCharacters(rendered);
  assert.match(text, /Command\s+Source\s+Uses/);
  assert.match(text, /Deploy > Deployment Sta…\s+setup\s+0/);
  assert.equal(resizeListeners, 0);
});

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

test('selectCommand accepts q as text at the start of a query', async () => {
  const { result, rendered } = await drive(['q', KEY.escape]);
  assert.equal(result, null);
  assert.ok(rendered.includes('No matching commands'));
});

test('selectCommand supports global record search from the initial term', async () => {
  const { result, rendered } = await drive([KEY.enter], {
    initialTerm: '? Acme',
  });
  assert.equal(result.id, 'search-records');
  assert.equal(result.label, 'Search > Acme');
  assert.equal(rendered.includes('[undefined]'), false);
});

test('selectCommand requires a record term and lets the user edit after Enter', async () => {
  const { result, rendered } = await drive(['?', KEY.enter, 'A', KEY.enter]);
  assert.equal(result.label, 'Search > A');
  assert.ok(rendered.includes('Type a record search after ?'));
});

test('selectCommand lets a unique prefilled match be replaced before opening', async () => {
  const { result } = await drive(['\x15', ...'deploy', KEY.enter], {
    initialTerm: 'home',
  });
  assert.equal(result.id, searchCatalog(commands, 'deploy')[0].id);
});
