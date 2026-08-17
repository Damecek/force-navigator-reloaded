import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.__CLIENT_ID__ = 'test-client-id';

async function isAllowed(url) {
  const { isContentScriptAllowedDomain } = await import(
    `../src/shared/urlUtils.js?test=${Date.now()}-${Math.random()}`
  );
  return isContentScriptAllowedDomain(url);
}

test('command palette is allowed on sandbox Experience Cloud workspace pages', async () => {
  assert.equal(
    await isAllowed(
      'https://carvago--devas.sandbox.my.site.com/auctionvforcesite/communitySetup/cwApp.app#/c/home'
    ),
    true
  );
});

test('command palette is allowed on production Experience Cloud pages', async () => {
  assert.equal(await isAllowed('https://acme.my.site.com/community/s/'), true);
});
