import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.__CLIENT_ID__ = 'test-client-id';

function installChrome(launchWebAuthFlow) {
  global.chrome = {
    storage: {
      local: {
        get: async () => ({}),
        set: async () => {},
        remove: async () => {},
      },
    },
    identity: {
      getRedirectURL: () => 'https://example.chromiumapp.org/oauth2',
      launchWebAuthFlow,
    },
  };
}

async function loadAuth() {
  return import(
    `../src/background/auth/auth.js?test=${Date.now()}-${Math.random()}`
  );
}

test('interactiveLogin passes state to Salesforce and surfaces callback errors', async () => {
  let launchedUrl;
  installChrome(async ({ url }) => {
    launchedUrl = new URL(url);
    return 'https://example.chromiumapp.org/oauth2?error=access_denied&error_description=end-user+denied+authorization&state=abc';
  });
  const { interactiveLogin } = await loadAuth();
  await assert.rejects(
    interactiveLogin('acme.my.salesforce.com', { state: 'abc' }),
    (error) => {
      assert.equal(error.name, 'AuthFlowError');
      assert.equal(error.source, 'oauth_callback');
      assert.equal(error.error, 'access_denied');
      assert.equal(error.errorDescription, 'end-user denied authorization');
      return true;
    }
  );
  assert.equal(launchedUrl.searchParams.get('state'), 'abc');
  assert.equal(launchedUrl.hostname, 'acme.lightning.force.com');
});

test('interactiveLogin wraps the generic Chrome closure error without leaking the URL', async () => {
  installChrome(async () => {
    throw new Error('The user did not approve access.');
  });
  const { interactiveLogin } = await loadAuth();
  await assert.rejects(interactiveLogin('acme.my.salesforce.com'), (error) => {
    assert.equal(error.name, 'AuthFlowError');
    assert.equal(error.source, 'identity_api');
    assert.equal(error.message, 'The user did not approve access.');
    return true;
  });
});

test('interactiveLogin rejects a callback with a mismatched state or without a code', async () => {
  installChrome(
    async () =>
      'https://example.chromiumapp.org/oauth2?code=secret-code&state=other'
  );
  const { interactiveLogin } = await loadAuth();
  await assert.rejects(
    interactiveLogin('acme.my.salesforce.com', { state: 'abc' }),
    (error) => {
      assert.equal(error.error, 'state_mismatch');
      assert.doesNotMatch(error.message, /secret-code/);
      return true;
    }
  );

  installChrome(async () => 'https://example.chromiumapp.org/oauth2');
  const auth = await loadAuth();
  await assert.rejects(
    auth.interactiveLogin('acme.my.salesforce.com'),
    (error) => {
      assert.equal(error.source, 'oauth_callback');
      assert.equal(error.error, undefined);
      return true;
    }
  );
});

test('interactiveLogin reports token exchange errors as structured failures', async () => {
  installChrome(
    async () => 'https://example.chromiumapp.org/oauth2?code=good-code'
  );
  global.fetch = async () => ({
    ok: false,
    text: async () =>
      '{"error":"invalid_grant","error_description":"invalid authorization code"}',
  });
  const { interactiveLogin } = await loadAuth();
  await assert.rejects(interactiveLogin('acme.my.salesforce.com'), (error) => {
    assert.equal(error.source, 'token_exchange');
    assert.equal(error.error, 'invalid_grant');
    assert.doesNotMatch(error.message, /good-code/);
    return true;
  });
});

test('interactiveLogin discards the token of a superseded attempt', async () => {
  installChrome(
    async () => 'https://example.chromiumapp.org/oauth2?code=good-code'
  );
  const stored = [];
  global.chrome.storage.local.set = async (values) => {
    stored.push(...Object.keys(values));
  };
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      access_token: 'a',
      refresh_token: 'r',
      instance_url: 'https://acme.my.salesforce.com',
      scope: 'api refresh_token',
    }),
  });
  const { interactiveLogin } = await loadAuth();
  const token = await interactiveLogin('acme.my.salesforce.com', {
    shouldPersist: () => false,
  });
  assert.equal(token.access_token, 'a');
  assert.deepEqual(stored, []);
  await interactiveLogin('acme.my.salesforce.com', {
    shouldPersist: () => true,
  });
  assert.equal(stored.length, 1);
});

test('interactiveLogin rejects a callback error whose state does not match', async () => {
  installChrome(
    async () =>
      'https://example.chromiumapp.org/oauth2?error=access_denied&state=other'
  );
  const { interactiveLogin } = await loadAuth();
  await assert.rejects(
    interactiveLogin('acme.my.salesforce.com', { state: 'abc' }),
    (error) => {
      assert.equal(error.error, 'state_mismatch');
      return true;
    }
  );
});
