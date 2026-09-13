import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSearchRecordsCommand } from '../lib/core/index.js';
import { runPalette } from '../lib/services/palette.js';

const home = { id: 'app-home', label: 'Home', path: '/lightning/page/home' };

function fixture(commands = [home]) {
  const events = [];
  const options = {
    context: {
      org: {},
      orgId: 'test-org',
      username: 'test@example.invalid',
      instanceUrl: 'https://test.my.salesforce.com',
      catalog: { commands },
    },
    query: 'home',
    browser: 'firefox',
    dataDirectory: '/unused',
    log: (message) => events.push(['log', message]),
    warn: (message) => events.push(['warn', message]),
  };
  const services = {
    select: async (input) => {
      events.push(['select', input]);
      return home;
    },
    open: async (input) => {
      events.push(['open', input]);
    },
    history: {
      read: async () => ({ 'app-home': 3 }),
      record: async (id) => {
        events.push(['record', id]);
      },
    },
  };
  return { options, services, events };
}

test('a unique prefill still prompts, then opens and remembers the confirmed command', async () => {
  const { options, services, events } = fixture();
  await runPalette(options, services);
  assert.deepEqual(
    events.map(([name]) => name),
    ['select', 'open', 'log', 'record']
  );
  assert.equal(events[0][1].initialTerm, 'home');
  assert.equal(events[0][1].commands[0].usage, 3);
  assert.equal(
    events[1][1].command.url,
    'https://test.lightning.force.com/lightning/page/home'
  );
  assert.equal(events[1][1].browser, 'firefox');
  assert.equal(events[3][1], 'app-home');
});

test('cancellation neither opens nor records usage', async () => {
  const { options, services, events } = fixture();
  services.select = async () => null;
  await runPalette(options, services);
  assert.deepEqual(events, [['log', 'Selection cancelled.']]);
});

test('an empty catalog still allows a global record search', async () => {
  const { options, services, events } = fixture([]);
  services.select = async ({ commands }) => {
    assert.deepEqual(commands, []);
    return buildSearchRecordsCommand('Acme');
  };
  await runPalette(options, services);
  assert.equal(events[0][0], 'open');
  assert.equal(events[0][1].command.id, 'search-records');
  assert.ok(events[0][1].command.url.includes('/one/one.app#'));
});

test('failed navigation does not increment usage or claim success', async () => {
  const { options, services, events } = fixture();
  services.open = async () => {
    throw new Error('Browser unavailable');
  };
  await assert.rejects(runPalette(options, services), /Browser unavailable/);
  assert.deepEqual(
    events.map(([name]) => name),
    ['select']
  );
});

test('history failures do not prevent navigation', async () => {
  const { options, services, events } = fixture();
  services.history = {
    read: async () => {
      throw new Error('Unreadable');
    },
    record: async () => {
      throw new Error('Unwritable');
    },
  };
  await runPalette(options, services);
  assert.deepEqual(
    events.map(([name]) => name),
    ['warn', 'select', 'open', 'log', 'warn']
  );
  assert.equal(events[1][1].commands[0].usage, 0);
});
