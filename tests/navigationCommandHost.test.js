import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.__CLIENT_ID__ = 'test-client-id';

async function loadNavigationCommandUrlModule() {
  return import(
    `../src/lwc/modules/content/x/commandClassRegister/navigationCommandUrl.js?test=${Date.now()}-${Math.random()}`
  ).catch(() => ({}));
}

test('buildNavigationCommandUrl defaults navigation descriptors to the Lightning host', async () => {
  const { buildNavigationCommandUrl } = await loadNavigationCommandUrlModule();
  assert.equal(typeof buildNavigationCommandUrl, 'function');

  assert.equal(
    buildNavigationCommandUrl({
      hostname: 'acme.sandbox.my.salesforce.com',
      path: '/lightning/setup/Home/home',
    }),
    'https://acme.sandbox.lightning.force.com/lightning/setup/Home/home'
  );
});

test('buildNavigationCommandUrl resolves explicit core descriptors on the My Domain host', async () => {
  const { buildNavigationCommandUrl } = await loadNavigationCommandUrlModule();
  assert.equal(typeof buildNavigationCommandUrl, 'function');

  assert.equal(
    buildNavigationCommandUrl({
      hostname: 'acme.sandbox.lightning.force.com',
      path: '/servlet/networks/switch?networkId=0DB5g000000AbCd',
      host: 'core',
    }),
    'https://acme.sandbox.my.salesforce.com/servlet/networks/switch?networkId=0DB5g000000AbCd'
  );
});

for (const [hostname, setupHostname] of [
  [
    'carvago--devas.sandbox.lightning.force.com',
    'carvago--devas.sandbox.my.salesforce-setup.com',
  ],
  [
    'carvago--devas.sandbox.my.salesforce.com',
    'carvago--devas.sandbox.my.salesforce-setup.com',
  ],
  [
    'carvago--devas.sandbox.my.salesforce-setup.com',
    'carvago--devas.sandbox.my.salesforce-setup.com',
  ],
  ['carvago.lightning.force.com', 'carvago.my.salesforce-setup.com'],
  ['carvago.my.salesforce.com', 'carvago.my.salesforce-setup.com'],
  ['carvago.my.salesforce-setup.com', 'carvago.my.salesforce-setup.com'],
]) {
  test(`Web Console opens on the current org Setup domain from ${hostname}`, async () => {
    const { buildNavigationCommandUrl } =
      await loadNavigationCommandUrlModule();
    const { staticCommands } =
      await import('../src/background/staticCommands.js');
    const command = staticCommands.find(({ id }) => id === 'web-console');
    assert.ok(command);
    assert.equal(
      buildNavigationCommandUrl({ hostname, ...command }),
      `https://${setupHostname}/lwr/application/platformdx-webconsole?SetupDomainProbePassed=true&aura.lcdn=0`
    );
  });
}
