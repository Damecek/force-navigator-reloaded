import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addDestinationUrls,
  buildDestinationUrl,
} from '../lib/services/destination.js';

const productionInstance = 'https://acme.my.salesforce.com';
const sandboxInstance = 'https://acme--uat.sandbox.my.salesforce.com';

test('buildDestinationUrl selects the requested Salesforce host family', () => {
  const command = { id: 'home', path: '/lightning/page/home' };
  assert.equal(
    buildDestinationUrl(productionInstance, command),
    'https://acme.lightning.force.com/lightning/page/home'
  );
  assert.equal(
    buildDestinationUrl(productionInstance, { ...command, host: 'core' }),
    'https://acme.my.salesforce.com/lightning/page/home'
  );
  assert.equal(
    buildDestinationUrl(productionInstance, { ...command, host: 'setup' }),
    'https://acme.my.salesforce-setup.com/lightning/page/home'
  );
  assert.equal(
    buildDestinationUrl(sandboxInstance, command),
    'https://acme--uat.sandbox.lightning.force.com/lightning/page/home'
  );
});

test('addDestinationUrls makes default hosts explicit', () => {
  assert.deepEqual(
    addDestinationUrls(
      [
        {
          id: 'home',
          label: 'Home',
          path: '/lightning/page/home',
          source: 'static',
        },
      ],
      productionInstance
    ),
    [
      {
        id: 'home',
        label: 'Home',
        path: '/lightning/page/home',
        source: 'static',
        host: 'lightning',
        url: 'https://acme.lightning.force.com/lightning/page/home',
      },
    ]
  );
});

test('buildDestinationUrl rejects paths that can escape the Salesforce host', () => {
  for (const path of [
    'https://evil.example',
    '//evil.example/path',
    '/\\evil.example',
  ]) {
    assert.throws(
      () => buildDestinationUrl(productionInstance, { id: 'unsafe', path }),
      /invalid path/
    );
  }
  assert.throws(
    () =>
      buildDestinationUrl(productionInstance, {
        id: 'bad-host',
        path: '/lightning',
        host: 'other',
      }),
    /Unsupported command host/
  );
});
