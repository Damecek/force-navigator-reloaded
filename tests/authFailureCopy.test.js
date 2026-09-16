import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.__CLIENT_ID__ = 'test-client-id';

const { describeAuthFailure, formatOriginalError } =
  await import('../src/shared/authFailureCopy.js');

const NOT_INSTALLED = {
  kind: 'app_not_installed',
  confirmed: true,
  salesforceError: {
    error: 'invalid_client',
    description: 'app must be installed into org',
  },
};

test('missing installation copy names the app, the administrator, and the install steps', () => {
  const copy = describeAuthFailure(NOT_INSTALLED, {
    appLabel: 'Force Navigator Reloaded Prod',
  });
  assert.match(copy.title, /installed in this Salesforce org/);
  assert.match(
    copy.message,
    /Salesforce administrator needs to install the connected app/
  );
  assert.match(
    copy.message,
    /"Allowed" in Connected Apps OAuth Usage does not mean "Installed"/
  );
  assert.match(copy.adminSteps, /Setup > Connected Apps OAuth Usage/);
  assert.match(copy.adminSteps, /"Force Navigator Reloaded Prod"/);
  assert.match(copy.adminSteps, /Install/);
  assert.match(copy.adminSteps, /assign the user/);
  assert.equal(
    copy.originalError,
    'invalid_client: app must be installed into org'
  );
  assert.equal(copy.needsAdmin, true);
});

test('uses the build-specific connected app label by default', () => {
  const copy = describeAuthFailure(NOT_INSTALLED);
  assert.match(copy.adminSteps, /"Force Navigator Reloaded"/);
});

test('cancellation copy does not claim that installation is missing', () => {
  const copy = describeAuthFailure({
    kind: 'cancelled',
    confirmed: false,
    salesforceError: null,
  });
  assert.equal(copy.title, 'Authorization was not completed');
  assert.doesNotMatch(copy.message, /needs to install/);
  assert.match(copy.message, /ask your administrator to check/);
  assert.equal(copy.adminSteps, null);
  assert.equal(copy.originalError, null);
  assert.equal(copy.needsAdmin, false);
});

test('denied and other OAuth errors keep the original Salesforce error for diagnosis', () => {
  const denied = describeAuthFailure({
    kind: 'access_denied',
    confirmed: true,
    salesforceError: {
      error: 'access_denied',
      description: 'end-user denied authorization',
    },
  });
  assert.equal(denied.title, 'Authorization was declined');
  assert.equal(
    denied.originalError,
    'access_denied: end-user denied authorization'
  );

  const other = describeAuthFailure({
    kind: 'oauth_error',
    confirmed: true,
    salesforceError: { error: 'invalid_client', description: '' },
  });
  assert.equal(other.title, 'Salesforce reported an authorization error');
  assert.equal(other.originalError, 'invalid_client');
  assert.equal(formatOriginalError(null), null);
});

test('unknown input falls back to the incomplete wording', () => {
  assert.equal(
    describeAuthFailure(undefined).title,
    'Authorization was not completed'
  );
});
