import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.__CLIENT_ID__ = 'test-client-id';

const ORG = 'acme.sandbox.lightning.force.com';
const ORG_CORE = 'acme.sandbox.my.salesforce.com';
const ORG_SETUP = 'acme.sandbox.my.salesforce-setup.com';
const OTHER_ORG = 'beta.lightning.force.com';
const TOKEN_KEY = (host) => `${host}_sfToken`;
const TOKEN_ENDPOINT_SUFFIX = '/services/oauth2/token';

const records = new Map();
const storageArea = {
  async get(keys) {
    if (typeof keys === 'undefined') {
      return Object.fromEntries(records);
    }
    const list = Array.isArray(keys) ? keys : [keys];
    return Object.fromEntries(
      list
        .filter((key) => records.has(key))
        .map((key) => [key, records.get(key)])
    );
  },
  async set(values) {
    for (const [key, value] of Object.entries(values)) {
      records.set(key, structuredClone(value));
    }
  },
  async remove(keys) {
    for (const key of keys) {
      records.delete(key);
    }
  },
};

let authFlowRedirect = null;

global.chrome = {
  storage: { local: storageArea },
  identity: {
    getRedirectURL() {
      return 'https://example.chromiumapp.org/oauth2';
    },
    async launchWebAuthFlow() {
      return authFlowRedirect;
    },
  },
};

function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function tokenFor(host, overrides = {}) {
  const core = host.replace('.lightning.force.com', '.my.salesforce.com');
  return {
    access_token: `${host}-access-1`,
    instance_url: `https://${core}`,
    issued_at: Date.now() - 22 * 3600 * 1000,
    refresh_token: `${host}-refresh-1`,
    scope: 'web api refresh_token',
    token_type: 'Bearer',
    ...overrides,
  };
}

function seedToken(host, token = tokenFor(host)) {
  records.set(TOKEN_KEY(host), { value: token, preserve: true });
  return token;
}

function storedToken(host) {
  return records.get(TOKEN_KEY(host))?.value;
}

function jsonResponse(body) {
  return { ok: true, status: 200, json: async () => body };
}

function errorResponse(status, body) {
  return { ok: false, status, text: async () => JSON.stringify(body) };
}

/**
 * Routes token endpoint calls to `onToken` and records them.
 * @param {(request: {url: string, body: URLSearchParams}) => Promise<object>|object} onToken
 * @param {(url: string, init: object) => Promise<object>|object} [onApi]
 */
function mockFetch(onToken, onApi) {
  const tokenCalls = [];
  global.fetch = async (url, init = {}) => {
    if (String(url).endsWith(TOKEN_ENDPOINT_SUFFIX)) {
      const request = {
        url: String(url),
        body: new URLSearchParams(init.body),
      };
      tokenCalls.push(request);
      return onToken(request);
    }
    if (onApi) {
      return onApi(String(url), init);
    }
    throw new Error(`Unexpected fetch ${url}`);
  };
  return tokenCalls;
}

async function loadAuth() {
  return import(
    `../src/background/auth/auth.js?test=${Date.now()}-${Math.random()}`
  );
}

test.beforeEach(() => {
  records.clear();
  authFlowRedirect = null;
  global.fetch = async () => {
    throw new Error('Unexpected fetch call');
  };
});

test('parallel refreshes across hostname aliases share one token request', async () => {
  const { refreshToken } = await loadAuth();
  seedToken(ORG);
  const response = deferred();
  const tokenCalls = mockFetch(() => response.promise);

  const pending = [
    refreshToken(ORG),
    refreshToken(ORG_CORE),
    refreshToken(ORG_SETUP),
    refreshToken(ORG),
  ];
  response.resolve(
    jsonResponse({
      access_token: 'access-2',
      refresh_token: 'refresh-2',
      instance_url: `https://${ORG_CORE}`,
    })
  );
  const results = await Promise.all(pending);

  assert.equal(tokenCalls.length, 1);
  assert.equal(tokenCalls[0].body.get('refresh_token'), `${ORG}-refresh-1`);
  for (const result of results) {
    assert.equal(result.access_token, 'access-2');
  }
  assert.equal(storedToken(ORG).refresh_token, 'refresh-2');
});

test('refreshes for different orgs stay isolated', async () => {
  const { refreshToken } = await loadAuth();
  seedToken(ORG);
  seedToken(OTHER_ORG);
  const tokenCalls = mockFetch(({ body }) => {
    const used = body.get('refresh_token');
    return jsonResponse({
      access_token: `${used}-access-2`,
      refresh_token: `${used}-2`,
      instance_url: used.startsWith('beta')
        ? 'https://beta.my.salesforce.com'
        : `https://${ORG_CORE}`,
    });
  });

  await Promise.all([refreshToken(ORG), refreshToken(OTHER_ORG)]);

  assert.equal(tokenCalls.length, 2);
  assert.equal(storedToken(ORG).refresh_token, `${ORG}-refresh-1-2`);
  assert.equal(
    storedToken(OTHER_ORG).refresh_token,
    `${OTHER_ORG}-refresh-1-2`
  );
});

test('a late 401 reuses the token stored by an earlier refresh', async () => {
  const { refreshToken } = await loadAuth();
  const original = seedToken(ORG);
  const tokenCalls = mockFetch(() =>
    jsonResponse({
      access_token: `access-${tokenCalls.length + 1}`,
      refresh_token: `refresh-${tokenCalls.length + 1}`,
      instance_url: `https://${ORG_CORE}`,
    })
  );

  await refreshToken(ORG);
  const late = await refreshToken(ORG_CORE, {
    rejectedAccessToken: original.access_token,
  });

  assert.equal(tokenCalls.length, 1);
  assert.equal(late.access_token, 'access-2');

  const rejectedCurrent = await refreshToken(ORG, {
    rejectedAccessToken: 'access-2',
  });
  assert.equal(tokenCalls.length, 2);
  assert.equal(tokenCalls[1].body.get('refresh_token'), 'refresh-2');
  assert.equal(rejectedCurrent.access_token, 'access-3');
});

test('parallel 401 responses on one connection rotate the refresh token once', async () => {
  const { SalesforceConnection } = await import(
    `../src/background/salesforceConnection.js?test=${Date.now()}-${Math.random()}`
  );
  seedToken(ORG);
  const tokenResponse = deferred();
  const apiCalls = [];
  const tokenCalls = mockFetch(
    () => tokenResponse.promise,
    (url, init) => {
      apiCalls.push(init.headers.Authorization);
      if (init.headers.Authorization === `Bearer ${ORG}-access-1`) {
        return { ok: false, status: 401, text: async () => 'expired' };
      }
      return jsonResponse({ records: [{ Id: url.slice(-1) }] });
    }
  );
  const connection = new SalesforceConnection({
    instanceUrl: `https://${ORG_CORE}`,
    accessToken: `${ORG}-access-1`,
  });

  const pending = Promise.all([
    connection.query('SELECT Id FROM A'),
    connection.query('SELECT Id FROM B'),
    connection.toolingQuery('SELECT Id FROM C'),
  ]);
  while (apiCalls.length < 3) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  tokenResponse.resolve(
    jsonResponse({
      access_token: 'access-2',
      refresh_token: 'refresh-2',
      instance_url: `https://${ORG_CORE}`,
    })
  );
  const results = await pending;

  assert.equal(tokenCalls.length, 1);
  assert.equal(results.length, 3);
  assert.equal(storedToken(ORG).refresh_token, 'refresh-2');
  assert.equal(apiCalls.filter((h) => h === 'Bearer access-2').length, 3);

  const lateConnection = new SalesforceConnection({
    instanceUrl: `https://${ORG_CORE}`,
    accessToken: `${ORG}-access-1`,
  });
  await lateConnection.query('SELECT Id FROM D');
  assert.equal(tokenCalls.length, 1);
});

test('a delayed 401 on the same connection retains its request token', async () => {
  const { SalesforceConnection } = await import(
    `../src/background/salesforceConnection.js?test=${Date.now()}-${Math.random()}`
  );
  seedToken(ORG);
  const delayedResponse = deferred();
  const delayedStarted = deferred();
  const tokenCalls = mockFetch(
    () =>
      jsonResponse({
        access_token: `access-${tokenCalls.length + 1}`,
        refresh_token: `refresh-${tokenCalls.length + 1}`,
        instance_url: `https://${ORG_CORE}`,
      }),
    (url, init) => {
      if (init.headers.Authorization === `Bearer ${ORG}-access-1`) {
        if (url.includes('Delayed')) {
          delayedStarted.resolve();
          return delayedResponse.promise;
        }
        return errorResponse(401, { error: 'expired' });
      }
      return jsonResponse({ records: [{ Id: 'result' }] });
    }
  );
  const connection = new SalesforceConnection({
    instanceUrl: `https://${ORG_CORE}`,
    accessToken: `${ORG}-access-1`,
  });
  const delayed = connection.query('SELECT Id FROM Delayed');
  await delayedStarted.promise;
  await connection.query('SELECT Id FROM Immediate');
  delayedResponse.resolve(errorResponse(401, { error: 'expired' }));
  assert.deepEqual(await delayed, [{ Id: 'result' }]);
  assert.equal(tokenCalls.length, 1);
  assert.equal(storedToken(ORG).refresh_token, 'refresh-2');
});

function loginInteractively(interactiveLogin) {
  authFlowRedirect =
    'https://example.chromiumapp.org/oauth2?code=auth-code&state=attempt-1';
  return interactiveLogin(ORG, { state: 'attempt-1' });
}

test('a stale invalid_grant does not clear a newer interactive login', async () => {
  const { refreshToken, interactiveLogin } = await loadAuth();
  seedToken(ORG);
  const refreshResponse = deferred();
  const tokenCalls = mockFetch(({ body }) =>
    body.get('grant_type') === 'authorization_code'
      ? jsonResponse({
          access_token: 'interactive-access',
          refresh_token: 'interactive-refresh',
          instance_url: `https://${ORG_CORE}`,
          scope: 'web api refresh_token',
        })
      : refreshResponse.promise
  );

  const refresh = refreshToken(ORG);
  await loginInteractively(interactiveLogin);
  refreshResponse.resolve(
    errorResponse(400, {
      error: 'invalid_grant',
      error_description: 'token family revoked',
    })
  );
  const result = await refresh;

  assert.equal(tokenCalls.length, 2);
  assert.equal(result.access_token, 'interactive-access');
  assert.equal(storedToken(ORG).refresh_token, 'interactive-refresh');
});

test('a stale refresh success does not overwrite a newer interactive login', async () => {
  const { refreshToken, interactiveLogin } = await loadAuth();
  seedToken(ORG);
  const refreshResponse = deferred();
  mockFetch(({ body }) =>
    body.get('grant_type') === 'authorization_code'
      ? jsonResponse({
          access_token: 'interactive-access',
          refresh_token: 'interactive-refresh',
          instance_url: `https://${ORG_CORE}`,
          scope: 'web api refresh_token',
        })
      : refreshResponse.promise
  );

  const refresh = refreshToken(ORG);
  await loginInteractively(interactiveLogin);
  refreshResponse.resolve(
    jsonResponse({
      access_token: 'stale-access',
      refresh_token: 'stale-refresh',
      instance_url: `https://${ORG_CORE}`,
    })
  );
  const result = await refresh;

  assert.equal(result.access_token, 'interactive-access');
  assert.equal(storedToken(ORG).access_token, 'interactive-access');
  assert.equal(storedToken(ORG).refresh_token, 'interactive-refresh');
});

test('a lost response cannot resubmit its token after a worker restart', async () => {
  const { refreshToken } = await loadAuth();
  seedToken(ORG, tokenFor(ORG, { issued_at: Date.now() }));
  const tokenCalls = mockFetch(() => {
    throw new TypeError('Response lost after token consumption');
  });
  assert.equal(await refreshToken(ORG), null);
  assert.equal(storedToken(ORG).refreshPending, true);
  const restarted = await loadAuth();
  assert.equal(await restarted.ensureToken(ORG), null);
  assert.equal(await restarted.refreshToken(ORG), null);
  assert.equal(tokenCalls.length, 1);
  assert.equal(storedToken(ORG), undefined);
});

test('a worker interrupted during dispatch does not replay the pending token', async () => {
  const auth = await loadAuth();
  seedToken(ORG);
  const response = deferred();
  const started = deferred();
  const tokenCalls = mockFetch(() => {
    started.resolve();
    return response.promise;
  });
  const pending = auth.refreshToken(ORG);
  await started.promise;
  assert.equal(storedToken(ORG).refreshPending, true);
  const restarted = await loadAuth();
  assert.equal(await restarted.refreshToken(ORG), null);
  assert.equal(tokenCalls.length, 1);
  response.resolve(
    jsonResponse({
      access_token: 'access-2',
      refresh_token: 'refresh-2',
      instance_url: `https://${ORG_CORE}`,
    })
  );
  assert.equal(await pending, null);
});

test('a failed pre-dispatch write never submits a refresh token', async (t) => {
  const { refreshToken } = await loadAuth();
  const original = seedToken(ORG);
  const tokenCalls = mockFetch(() => {
    throw new Error('Must not dispatch');
  });
  t.mock.method(storageArea, 'set', async () => {
    throw new Error('Storage unavailable');
  });
  assert.equal(await refreshToken(ORG), null);
  assert.equal(tokenCalls.length, 0);
  assert.deepEqual(storedToken(ORG), original);
});

test('failure persisting rotated credentials leaves a durable replay guard', async (t) => {
  const { refreshToken } = await loadAuth();
  seedToken(ORG);
  const write = storageArea.set.bind(storageArea);
  t.mock.method(storageArea, 'set', async (values) => {
    if (values[TOKEN_KEY(ORG)]?.value.access_token === 'access-2') {
      throw new Error('Storage unavailable');
    }
    return write(values);
  });
  const tokenCalls = mockFetch(() =>
    jsonResponse({
      access_token: 'access-2',
      refresh_token: 'refresh-2',
      instance_url: `https://${ORG_CORE}`,
    })
  );
  assert.equal(await refreshToken(ORG), null);
  assert.equal(storedToken(ORG).refreshPending, true);
  const restarted = await loadAuth();
  assert.equal(await restarted.refreshToken(ORG), null);
  assert.equal(tokenCalls.length, 1);
});

test('a lost refresh response returns a newer interactive login', async () => {
  const { refreshToken, interactiveLogin } = await loadAuth();
  seedToken(ORG);
  const response = deferred();
  mockFetch(({ body }) =>
    body.get('grant_type') === 'authorization_code'
      ? jsonResponse({
          access_token: 'interactive-access',
          refresh_token: 'interactive-refresh',
          instance_url: `https://${ORG_CORE}`,
          scope: 'web api refresh_token',
        })
      : response.promise
  );
  const pending = refreshToken(ORG);
  await loginInteractively(interactiveLogin);
  response.resolve({
    ok: true,
    json: async () => {
      throw new Error('Response truncated');
    },
  });
  assert.equal((await pending).access_token, 'interactive-access');
  assert.equal(storedToken(ORG).refresh_token, 'interactive-refresh');
});

test('a new interactive login is not blocked by an earlier refresh failure', async () => {
  const { refreshToken } = await loadAuth();
  seedToken(ORG);
  const tokenCalls = mockFetch(({ body }) =>
    body.get('refresh_token') === `${ORG}-refresh-1`
      ? errorResponse(503, { error: 'server_error' })
      : jsonResponse({
          access_token: 'access-3',
          refresh_token: 'refresh-3',
          instance_url: `https://${ORG_CORE}`,
        })
  );

  assert.equal(await refreshToken(ORG), null);
  seedToken(ORG, tokenFor(ORG, { refresh_token: 'new-login-refresh' }));
  const result = await refreshToken(ORG);

  assert.equal(tokenCalls.length, 2);
  assert.equal(result.access_token, 'access-3');
});

test('ensureWebScopedToken refreshes an old token only once', async () => {
  const { ensureWebScopedToken } = await loadAuth();
  seedToken(ORG);
  const tokenCalls = mockFetch(() =>
    jsonResponse({
      access_token: `access-${tokenCalls.length + 1}`,
      instance_url: `https://${ORG_CORE}`,
    })
  );

  const token = await ensureWebScopedToken(ORG);

  assert.equal(tokenCalls.length, 1);
  assert.equal(token.access_token, 'access-2');
  assert.equal(token.refresh_token, `${ORG}-refresh-1`);
});
