import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.__CLIENT_ID__ = 'test-client-id';

const { buildAdminInstallSteps, buildAdminInstructions } =
  await import('../src/shared/authorizationHelp.js');

test('administrator steps cover Setup path, Allowed vs Installed, Install, user assignment, and retry', () => {
  const steps = buildAdminInstallSteps('Force Navigator Reloaded Prod');
  assert.equal(steps.length, 5);
  assert.match(steps[0], /Connected Apps OAuth Usage/);
  assert.match(steps[1], /"Allowed" only means/);
  assert.match(
    steps[2],
    /Click Install next to "Force Navigator Reloaded Prod"/
  );
  assert.match(steps[3], /Permitted Users/);
  assert.match(steps[4], /Extension > Authorize/);
});

test('copyable instructions name the org, the error, and the app without secrets', () => {
  const text = buildAdminInstructions({
    appLabel: 'Force Navigator Reloaded Dev',
    orgHostname: 'acme.my.salesforce.com',
  });
  assert.match(text, /in acme\.my\.salesforce\.com/);
  assert.match(text, /invalid_client: app must be installed into org/);
  assert.match(
    text,
    /"Force Navigator Reloaded Dev" is allowed but not installed/
  );
  assert.match(text, /^1\. /m);
  assert.match(text, /^5\. /m);
  assert.doesNotMatch(text, /token|code=/i);
  assert.match(buildAdminInstructions(), /in our Salesforce org/);
});
