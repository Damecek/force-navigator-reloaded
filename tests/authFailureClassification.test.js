import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTH_FAILURE_KIND,
  AUTH_FAILURE_SOURCE,
  classifyAuthFailure,
  sanitizeAuthErrorText,
  selectAuthFailure,
} from '../src/shared/authFailure.js';

test('classifies the Salesforce missing-installation error page as confirmed app_not_installed', () => {
  const failure = classifyAuthFailure({
    error: 'invalid_client',
    errorDescription: 'app must be installed into org',
    source: AUTH_FAILURE_SOURCE.SALESFORCE_ERROR_PAGE,
  });
  assert.equal(failure.kind, AUTH_FAILURE_KIND.APP_NOT_INSTALLED);
  assert.equal(failure.confirmed, true);
  assert.deepEqual(failure.salesforceError, {
    error: 'invalid_client',
    description: 'app must be installed into org',
  });
});

test('does not infer missing installation from a generic invalid_client error', () => {
  const failure = classifyAuthFailure({
    error: 'invalid_client',
    errorDescription: 'invalid client credentials',
    source: AUTH_FAILURE_SOURCE.SALESFORCE_ERROR_PAGE,
  });
  assert.equal(failure.kind, AUTH_FAILURE_KIND.OAUTH_ERROR);
  assert.equal(failure.confirmed, true);
});

test('classifies a callback access_denied error as confirmed denial', () => {
  const failure = classifyAuthFailure({
    error: 'access_denied',
    errorDescription: 'end-user denied authorization',
    source: AUTH_FAILURE_SOURCE.OAUTH_CALLBACK,
  });
  assert.equal(failure.kind, AUTH_FAILURE_KIND.ACCESS_DENIED);
  assert.equal(failure.confirmed, true);
});

test('classifies the closed OAuth window as an unconfirmed cancellation', () => {
  const failure = classifyAuthFailure({
    source: AUTH_FAILURE_SOURCE.IDENTITY_API,
    message: 'The user did not approve access.',
  });
  assert.equal(failure.kind, AUTH_FAILURE_KIND.CANCELLED);
  assert.equal(failure.confirmed, false);
  assert.equal(failure.salesforceError, null);
});

test('classifies unknown errors as incomplete without asserting a cause', () => {
  const failure = classifyAuthFailure({ message: 'Something odd happened' });
  assert.equal(failure.kind, AUTH_FAILURE_KIND.INCOMPLETE);
  assert.equal(failure.confirmed, false);
});

test('classifies token exchange failures as confirmed OAuth errors', () => {
  const failure = classifyAuthFailure({
    source: AUTH_FAILURE_SOURCE.TOKEN_EXCHANGE,
    error: 'invalid_grant',
    errorDescription: 'invalid authorization code',
  });
  assert.equal(failure.kind, AUTH_FAILURE_KIND.OAUTH_ERROR);
  assert.equal(failure.confirmed, true);
});

test('sanitizes URLs, codes, and tokens out of diagnostic text', () => {
  const text =
    'Received https://x.chromiumapp.org/oauth2?code=aPrx.secret&state=1 and access_token=00D!abc plus ' +
    'x'.repeat(300);
  const sanitized = sanitizeAuthErrorText(text);
  assert.doesNotMatch(sanitized, /chromiumapp/);
  assert.doesNotMatch(sanitized, /aPrx/);
  assert.doesNotMatch(sanitized, /00D!abc/);
  assert.match(sanitized, /access_token=\[redacted\]/);
  assert.ok(sanitized.length <= 200);
});

test('a confirmed cause recorded from the error page wins over the generic closure error', () => {
  const recorded = classifyAuthFailure({
    error: 'invalid_client',
    errorDescription: 'app must be installed into org',
    source: AUTH_FAILURE_SOURCE.SALESFORCE_ERROR_PAGE,
  });
  const terminal = classifyAuthFailure({
    source: AUTH_FAILURE_SOURCE.IDENTITY_API,
    message: 'The user did not approve access.',
  });
  assert.equal(selectAuthFailure(recorded, terminal), recorded);
  assert.equal(selectAuthFailure(null, terminal), terminal);
  assert.equal(selectAuthFailure(undefined, terminal), terminal);
});

test('a confirmed terminal callback error wins over nothing recorded', () => {
  const terminal = classifyAuthFailure({
    error: 'access_denied',
    source: AUTH_FAILURE_SOURCE.OAUTH_CALLBACK,
  });
  assert.equal(
    selectAuthFailure(null, terminal).kind,
    AUTH_FAILURE_KIND.ACCESS_DENIED
  );
});
