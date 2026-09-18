import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.__CLIENT_ID__ = 'test-client-id';

const { parseOauthErrorPage } =
  await import('../src/content_scripts/oauthErrorPageDetection.js');

test('parses the Salesforce OAuth error page fields', () => {
  const report = parseOauthErrorPage(
    new URL(
      'https://acme.sandbox.my.salesforce.com/setup/secur/RemoteAccessErrorPage.apexp?error=invalid_client&error_description=app+must+be+installed+into+org&state=attempt-1'
    )
  );
  assert.deepEqual(report, {
    error: 'invalid_client',
    errorDescription: 'app must be installed into org',
    state: 'attempt-1',
  });
});

test('reports null state when Salesforce does not echo it', () => {
  const report = parseOauthErrorPage(
    new URL(
      'https://acme.my.salesforce.com/setup/secur/RemoteAccessErrorPage.apexp?error=access_denied'
    )
  );
  assert.equal(report.error, 'access_denied');
  assert.equal(report.errorDescription, '');
  assert.equal(report.state, null);
});

test('ignores other My Domain pages and error pages without an error code', () => {
  assert.equal(
    parseOauthErrorPage(new URL('https://acme.my.salesforce.com/?ec=302')),
    null
  );
  assert.equal(
    parseOauthErrorPage(
      new URL(
        'https://acme.my.salesforce.com/setup/secur/RemoteAccessErrorPage.apexp'
      )
    ),
    null
  );
});
