import assert from 'node:assert/strict';
import test from 'node:test';
import { openNavigation } from '../src/services/navigation.js';

test('openNavigation passes the safe destination through single-access auth in memory', async () => {
  const calls = [];
  const org = {
    getFrontDoorUrl: async (destination) => {
      calls.push(['frontdoor', destination]);
      return 'https://acme.my.salesforce.com/secur/frontdoor.jsp?sid=secret';
    },
  };
  await openNavigation({
    org,
    command: {
      path: '/lightning/page/home',
      url: 'https://acme.lightning.force.com/lightning/page/home',
    },
    browser: 'firefox',
    opener: async (url, browser) => calls.push(['open', url, browser]),
  });
  assert.deepEqual(calls, [
    ['frontdoor', '/lightning/page/home'],
    [
      'open',
      'https://acme.my.salesforce.com/secur/frontdoor.jsp?sid=secret',
      'firefox',
    ],
  ]);
});

test('openNavigation returns no authenticated URL', async () => {
  const result = await openNavigation({
    org: { getFrontDoorUrl: async () => 'https://example.test/?sid=secret' },
    command: { path: '/destination', url: 'https://example.test/destination' },
    opener: async () => {},
  });
  assert.equal(result, undefined);
});

test('openNavigation removes SDK error details that may contain auth data', async () => {
  const secret = 'sid=secret';
  await assert.rejects(
    openNavigation({
      org: {
        getFrontDoorUrl: async () => {
          throw new Error(`request failed: ${secret}`);
        },
      },
      command: {
        path: '/destination',
        url: 'https://example.test/destination',
      },
      opener: async () => assert.fail('opener must not run'),
    }),
    (error) => {
      assert.equal(
        error.message,
        'Unable to create an authenticated browser session for the target org.'
      );
      assert.equal(error.message.includes(secret), false);
      return true;
    }
  );
});
