import test from 'node:test';
import assert from 'node:assert/strict';
import {
  athOf,
  createFakeIndexedDb,
  createStorageArea,
  createTokenEndpoint,
  jsonResponse,
  thumbprintOf,
} from './helpers/dpop.js';

globalThis.__CLIENT_ID__ = 'test-client-id';

const ORG = 'acme.sandbox.lightning.force.com';
const ORG_CORE = 'acme.sandbox.my.salesforce.com';
const ORG_SETUP = 'acme.sandbox.my.salesforce-setup.com';
const OTHER_ORG = 'beta.lightning.force.com';
const OTHER_CORE = 'beta.my.salesforce.com';
const TOKEN_KEY = (host) => `${host}_sfToken`;
const TOKEN_PATH = '/services/oauth2/token';
const REDIRECT = 'https://example.chromiumapp.org/oauth2';

const storageArea = createStorageArea();
const idb = createFakeIndexedDb();
globalThis.indexedDB = idb;
let authorizeUrl = null;

global.chrome = {
  storage: { local: storageArea },
  identity: {
    getRedirectURL() {
      return REDIRECT;
    },
    async launchWebAuthFlow({ url }) {
      authorizeUrl = new URL(url);
      return `${REDIRECT}?code=auth-code`;
    },
  },
};

const coreOf = (host) => (host === ORG ? ORG_CORE : OTHER_CORE);
const storedToken = (host) => storageArea.records.get(TOKEN_KEY(host))?.value;
const keysOf = (host) => idb.records().filter((r) => r.scope === host);

function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

let issued = 0;
function issueToken(host, tokenType = 'DPoP') {
  issued += 1;
  return jsonResponse(200, {
    access_token: `00D${host}!access-${issued}`,
    refresh_token: `refresh-${host}-${issued}`,
    instance_url: `https://${coreOf(host)}`,
    scope: 'refresh_token web api',
    token_type: tokenType,
  });
}

/**
 * Routes token endpoint requests of both orgs to simulated endpoints and
 * everything else to `onApi`.
 */
function installSalesforce({ tokenType = 'DPoP', onApi } = {}) {
  const endpoints = {
    [ORG_CORE]: createTokenEndpoint(() => issueToken(ORG, tokenType)),
    [OTHER_CORE]: createTokenEndpoint(() => issueToken(OTHER_ORG, tokenType)),
  };
  const apiCalls = [];
  global.fetch = async (url, init = {}) => {
    const parsed = new URL(url);
    if (parsed.pathname === TOKEN_PATH) {
      return endpoints[parsed.hostname].handle(String(url), init);
    }
    apiCalls.push({ url: String(url), init });
    return onApi(String(url), init);
  };
  return { endpoints, apiCalls, token: endpoints[ORG_CORE] };
}

async function loadAuth() {
  return import(
    `../src/background/auth/auth.js?test=${Date.now()}-${Math.random()}`
  );
}

async function loadConnection() {
  return import(
    `../src/background/salesforceConnection.js?test=${Date.now()}-${Math.random()}`
  );
}

async function loadBridge() {
  return import(
    `../src/background/auth/uiSessionBridge.js?test=${Date.now()}-${Math.random()}`
  );
}

/** Log in through the real interactive flow and return the stored grant. */
async function login(auth, host = ORG) {
  await auth.interactiveLogin(host);
  return storedToken(host);
}

function ageToken(host) {
  const entry = storageArea.records.get(TOKEN_KEY(host));
  entry.value.issued_at = Date.now() - 22 * 3600 * 1000;
}

test.beforeEach(() => {
  storageArea.records.clear();
  storageArea.failNextSet = false;
  idb.clear();
  idb.failWith = null;
  authorizeUrl = null;
  global.fetch = async () => {
    throw new Error('Unexpected fetch call');
  };
});

test('interactive login binds the grant to a new non-extractable key', async () => {
  const { token } = installSalesforce();
  const auth = await loadAuth();

  const stored = await login(auth);

  const jkt = authorizeUrl.searchParams.get('dpop_jkt');
  assert.equal(authorizeUrl.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(authorizeUrl.searchParams.get('code_challenge'));
  assert.equal(token.calls.length, 2);
  const [challenged, accepted] = token.calls;
  for (const call of token.calls) {
    assert.equal(call.proof.valid, true);
    assert.equal(call.proof.header.typ, 'dpop+jwt');
    assert.equal(call.proof.header.alg, 'ES256');
    assert.equal(thumbprintOf(call.proof.header.jwk), jkt);
    assert.equal(call.proof.payload.htm, 'POST');
    assert.equal(call.proof.payload.htu, `https://${ORG_CORE}${TOKEN_PATH}`);
    assert.equal(call.proof.payload.ath, undefined);
    assert.equal(call.body.get('code'), 'auth-code');
    assert.ok(call.body.get('code_verifier'));
    assert.equal(call.redirect, 'error');
  }
  assert.equal(challenged.proof.payload.nonce, undefined);
  assert.equal(accepted.proof.payload.nonce, 'server-nonce-1');
  assert.notEqual(challenged.proof.payload.jti, accepted.proof.payload.jti);
  assert.equal(
    challenged.body.get('code_verifier'),
    accepted.body.get('code_verifier')
  );

  assert.equal(stored.token_type, 'DPoP');
  assert.equal(stored.dpop_jkt, jkt);
  assert.equal(stored.dpop_nonce, 'server-nonce-1');
  assert.equal(stored.client_id, 'test-client-id');
  const [record] = keysOf(ORG);
  assert.equal(idb.records().length, 1);
  assert.equal(record.thumbprint, jkt);
  assert.equal(record.privateKey.extractable, false);
  assert.equal(JSON.stringify(stored).includes('"d"'), false);
});

test('a Bearer answer to a DPoP login is stored as a bearer grant without a key', async () => {
  installSalesforce({ tokenType: 'Bearer' });
  const auth = await loadAuth();

  const stored = await login(auth);

  assert.equal(stored.token_type, 'Bearer');
  assert.equal(stored.dpop_jkt, undefined);
  assert.equal(stored.dpop_nonce, undefined);
  assert.equal(stored.client_id, undefined);
  assert.deepEqual(idb.records(), []);
});

test('a new login replaces the key of its org and keeps the key of another org', async () => {
  installSalesforce();
  const auth = await loadAuth();
  const first = await login(auth);
  const other = await login(auth, OTHER_ORG);

  const second = await login(auth);

  assert.notEqual(second.dpop_jkt, first.dpop_jkt);
  assert.notEqual(second.dpop_jkt, other.dpop_jkt);
  assert.deepEqual(
    keysOf(ORG).map((r) => r.thumbprint),
    [second.dpop_jkt]
  );
  assert.deepEqual(
    keysOf(OTHER_ORG).map((r) => r.thumbprint),
    [other.dpop_jkt]
  );
});

test('a login whose token cannot be stored keeps the previous grant and its key', async () => {
  installSalesforce();
  const auth = await loadAuth();
  const first = await login(auth);

  storageArea.failNextSet = true;
  await assert.rejects(auth.interactiveLogin(ORG), /storage write failed/);

  assert.equal(storedToken(ORG).access_token, first.access_token);
  assert.deepEqual(
    keysOf(ORG).map((r) => r.thumbprint),
    [first.dpop_jkt]
  );
});

test('a login whose key cannot be stored does not store a bound token', async () => {
  installSalesforce();
  const auth = await loadAuth();

  idb.failWith = new Error('idb unavailable');
  await assert.rejects(auth.interactiveLogin(ORG), /idb unavailable/);

  assert.equal(storedToken(ORG), undefined);
});

test('a login superseded while its key is stored writes neither token nor key', async () => {
  installSalesforce();
  const auth = await loadAuth();
  const first = await login(auth);
  let checks = 0;

  await auth.interactiveLogin(ORG, {
    shouldPersist: () => {
      checks += 1;
      return checks === 1;
    },
  });

  assert.equal(checks, 2);
  assert.equal(storedToken(ORG).access_token, first.access_token);
  assert.deepEqual(
    keysOf(ORG).map((r) => r.thumbprint),
    [first.dpop_jkt]
  );
});

test('a bound refresh proves possession, takes a fresh nonce, and keeps the binding', async () => {
  const { token } = installSalesforce();
  const auth = await loadAuth();
  const before = await login(auth);
  ageToken(ORG);
  token.calls.length = 0;
  token.nonce = 'server-nonce-2';

  const refreshed = await auth.ensureToken(ORG);

  assert.equal(token.calls.length, 2);
  const [challenged, accepted] = token.calls;
  assert.equal(challenged.proof.payload.nonce, undefined);
  assert.equal(accepted.proof.payload.nonce, 'server-nonce-2');
  for (const call of token.calls) {
    assert.equal(call.proof.valid, true);
    assert.equal(thumbprintOf(call.proof.header.jwk), before.dpop_jkt);
    assert.equal(call.proof.payload.ath, undefined);
    assert.equal(call.body.get('grant_type'), 'refresh_token');
    assert.equal(call.body.get('refresh_token'), before.refresh_token);
    assert.equal(call.redirect, 'error');
  }
  const stored = storedToken(ORG);
  assert.deepEqual(refreshed, stored);
  assert.notEqual(stored.refresh_token, before.refresh_token);
  assert.equal(stored.token_type, 'DPoP');
  assert.equal(stored.dpop_jkt, before.dpop_jkt);
  assert.equal(stored.dpop_nonce, 'server-nonce-2');
  assert.equal(stored.client_id, 'test-client-id');
  assert.equal(stored.refreshPending, undefined);
  assert.equal(keysOf(ORG).length, 1);
});

test('eight concurrent callers across aliases share one bound refresh per org', async () => {
  const { endpoints } = installSalesforce();
  const auth = await loadAuth();
  await login(auth);
  await login(auth, OTHER_ORG);
  ageToken(ORG);
  ageToken(OTHER_ORG);
  endpoints[ORG_CORE].calls.length = 0;
  endpoints[OTHER_CORE].calls.length = 0;

  const hosts = [ORG, ORG_CORE, ORG_SETUP, ORG, ORG_CORE, ORG_SETUP, ORG, ORG];
  const results = await Promise.all([
    ...hosts.map((host) => auth.ensureToken(host)),
    ...Array.from({ length: 8 }, () => auth.ensureToken(OTHER_ORG)),
  ]);

  for (const endpoint of [endpoints[ORG_CORE], endpoints[OTHER_CORE]]) {
    assert.equal(endpoint.calls.length, 2);
    assert.equal(
      endpoint.calls.filter((call) => call.proof.payload.nonce).length,
      1
    );
  }
  assert.equal(new Set(results.slice(0, 8).map((t) => t.access_token)).size, 1);
  assert.equal(new Set(results.slice(8).map((t) => t.access_token)).size, 1);
  assert.notEqual(storedToken(ORG).dpop_jkt, storedToken(OTHER_ORG).dpop_jkt);
});

test('a bearer grant refreshes without a proof and stays a bearer grant', async () => {
  const { token } = installSalesforce({ tokenType: 'Bearer' });
  const auth = await loadAuth();
  await login(auth);
  ageToken(ORG);
  token.calls.length = 0;

  const refreshed = await auth.ensureToken(ORG);

  assert.equal(token.calls.length, 1);
  assert.equal(token.calls[0].raw, undefined);
  assert.equal(refreshed.token_type, 'Bearer');
  assert.equal(refreshed.dpop_jkt, undefined);
  assert.deepEqual(idb.records(), []);
});

test('a bound grant whose key is missing is cleared and never sent', async () => {
  for (const entryPoint of ['ensureToken', 'refreshToken']) {
    installSalesforce();
    const auth = await loadAuth();
    await login(auth);
    ageToken(ORG);
    idb.clear();
    global.fetch = async () => {
      throw new Error('Unexpected fetch call');
    };

    assert.equal(await auth[entryPoint](ORG), null);
    assert.equal(storedToken(ORG), undefined);
  }
});

test('a key stored for another org does not unlock a bound grant', async () => {
  installSalesforce();
  const auth = await loadAuth();
  await login(auth);
  keysOf(ORG)[0].scope = OTHER_ORG;
  global.fetch = async () => {
    throw new Error('Unexpected fetch call');
  };

  assert.equal(await auth.ensureToken(ORG), null);
  assert.equal(storedToken(ORG), undefined);
});

test('a bound grant stored under another org is never used for that org', async () => {
  installSalesforce();
  const auth = await loadAuth();
  await login(auth, OTHER_ORG);
  storageArea.records.set(
    TOKEN_KEY(ORG),
    structuredClone(storageArea.records.get(TOKEN_KEY(OTHER_ORG)))
  );
  ageToken(ORG);
  global.fetch = async () => {
    throw new Error('Unexpected fetch call');
  };

  assert.equal(await auth.ensureToken(ORG), null);
  assert.equal(storedToken(ORG), undefined);
  assert.equal(keysOf(OTHER_ORG).length, 1);
  assert.equal(storedToken(OTHER_ORG).token_type, 'DPoP');

  storageArea.records.set(
    TOKEN_KEY(ORG),
    structuredClone(storageArea.records.get(TOKEN_KEY(OTHER_ORG)))
  );
  assert.equal(
    await auth.refreshToken(ORG, { rejectedAccessToken: 'rejected-token' }),
    null
  );
  assert.equal(storedToken(ORG), undefined);
  assert.equal(keysOf(OTHER_ORG).length, 1);
});

test('a 401 challenge from the token endpoint is not retried', async () => {
  installSalesforce();
  const auth = await loadAuth();
  await login(auth);
  ageToken(ORG);
  let requests = 0;
  global.fetch = async () => {
    requests += 1;
    return jsonResponse(
      401,
      { error: 'use_dpop_nonce' },
      { 'DPoP-Nonce': 'nonce-1' }
    );
  };

  assert.equal(await auth.ensureToken(ORG), null);

  assert.equal(requests, 1);
  assert.equal(storedToken(ORG).refreshPending, true);
});

test('a bound grant issued to another OAuth client requires authorization', async () => {
  installSalesforce();
  const auth = await loadAuth();
  await login(auth);
  storageArea.records.get(TOKEN_KEY(ORG)).value.client_id = 'other-client';
  ageToken(ORG);
  global.fetch = async () => {
    throw new Error('Unexpected fetch call');
  };

  assert.equal(await auth.refreshToken(ORG), null);
  assert.equal(storedToken(ORG), undefined);
  assert.deepEqual(keysOf(ORG), []);
});

test('a key store failure does not destroy a bound grant', async () => {
  installSalesforce();
  const auth = await loadAuth();
  const before = await login(auth);
  idb.failWith = new Error('idb unavailable');

  await assert.rejects(auth.ensureToken(ORG), /idb unavailable/);
  await assert.rejects(auth.refreshToken(ORG), /idb unavailable/);

  assert.deepEqual(storedToken(ORG), before);
});

test('a Bearer answer to a bound refresh is rejected and never downgrades the grant', async () => {
  const { token } = installSalesforce();
  const auth = await loadAuth();
  const before = await login(auth);
  ageToken(ORG);
  token.calls.length = 0;
  const bound = global.fetch;
  global.fetch = async (url, init) => {
    const response = await bound(url, init);
    if (response.status !== 200) {
      return response;
    }
    return jsonResponse(200, {
      ...(await response.json()),
      token_type: 'Bearer',
    });
  };

  assert.equal(await auth.ensureToken(ORG), null);

  const stored = storedToken(ORG);
  assert.equal(stored.token_type, 'DPoP');
  assert.equal(stored.access_token, before.access_token);
  assert.equal(stored.refreshPending, true);
  global.fetch = async () => {
    throw new Error('Unexpected fetch call');
  };
  assert.equal(await (await loadAuth()).ensureToken(ORG), null);
  assert.equal(storedToken(ORG), undefined);
  assert.deepEqual(keysOf(ORG), []);
});

test('a repeated nonce challenge is not retried again', async () => {
  const { token } = installSalesforce();
  const auth = await loadAuth();
  await login(auth);
  ageToken(ORG);
  token.calls.length = 0;
  let requests = 0;
  global.fetch = async () => {
    requests += 1;
    return jsonResponse(
      400,
      { error: 'use_dpop_nonce' },
      { 'DPoP-Nonce': `nonce-${requests}` }
    );
  };

  assert.equal(await auth.ensureToken(ORG), null);

  assert.equal(requests, 2);
  assert.equal(storedToken(ORG).refreshPending, true);
});

test('a lost response after the nonce challenge is never replayed', async () => {
  const { token } = installSalesforce();
  const auth = await loadAuth();
  const before = await login(auth);
  ageToken(ORG);
  token.calls.length = 0;
  const challenge = global.fetch;
  let requests = 0;
  global.fetch = async (url, init) => {
    requests += 1;
    if (requests === 1) {
      return challenge(url, init);
    }
    throw new Error('network down');
  };

  assert.equal(await auth.ensureToken(ORG), null);

  assert.equal(requests, 2);
  assert.equal(storedToken(ORG).refreshPending, true);
  assert.equal(storedToken(ORG).refresh_token, before.refresh_token);
  global.fetch = async () => {
    throw new Error('Unexpected fetch call');
  };
  assert.equal(await (await loadAuth()).refreshToken(ORG), null);
  assert.equal(storedToken(ORG), undefined);
});

test('a challenge without a valid nonce is treated as a failed refresh', async () => {
  installSalesforce();
  const auth = await loadAuth();
  await login(auth);
  ageToken(ORG);
  let requests = 0;
  global.fetch = async () => {
    requests += 1;
    return jsonResponse(
      400,
      { error: 'use_dpop_nonce' },
      { 'DPoP-Nonce': 'bad nonce' }
    );
  };

  assert.equal(await auth.ensureToken(ORG), null);

  assert.equal(requests, 1);
  assert.equal(storedToken(ORG).refreshPending, true);
});

test('a stale bound refresh does not overwrite a newer login or its key', async () => {
  const { token } = installSalesforce();
  const auth = await loadAuth();
  await login(auth);
  ageToken(ORG);
  const gate = deferred();
  const salesforce = global.fetch;
  let refreshRequests = 0;
  global.fetch = async (url, init = {}) => {
    const isRefresh =
      new URLSearchParams(init.body).get('grant_type') === 'refresh_token';
    if (isRefresh) {
      refreshRequests += 1;
      if (refreshRequests === 2) {
        await gate.promise;
      }
    }
    return salesforce(url, init);
  };

  const refresh = auth.refreshToken(ORG);
  while (refreshRequests < 2) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  const newer = await login(auth);
  gate.resolve();
  const result = await refresh;

  assert.equal(result.access_token, newer.access_token);
  assert.deepEqual(storedToken(ORG), newer);
  assert.deepEqual(
    keysOf(ORG).map((r) => r.thumbprint),
    [newer.dpop_jkt]
  );
  assert.ok(token.calls.length >= 4);
});

test('a bound connection signs every request for its method, URL, and token', async () => {
  const salesforce = installSalesforce({
    onApi: async (url) =>
      jsonResponse(
        200,
        url.includes('/query/?')
          ? {
              records: [{ Id: '1' }],
              nextRecordsUrl: '/services/data/v62.0/query/01g-2000',
            }
          : { records: [{ Id: '2' }] }
      ),
  });
  const auth = await loadAuth();
  const grant = await login(auth);
  const { SalesforceConnection } = await loadConnection();
  const { readProof } = await import('./helpers/dpop.js');

  const records = await new SalesforceConnection({
    instanceUrl: grant.instance_url,
    token: grant,
  }).toolingQuery('SELECT Id FROM ApexClass');

  assert.deepEqual(records, [{ Id: '1' }, { Id: '2' }]);
  assert.equal(salesforce.apiCalls.length, 2);
  const proofs = [];
  for (const { url, init } of salesforce.apiCalls) {
    assert.equal(init.headers.Authorization, `DPoP ${grant.access_token}`);
    const proof = await readProof(init.headers.DPoP);
    proofs.push(proof);
    assert.equal(proof.valid, true);
    assert.equal(thumbprintOf(proof.header.jwk), grant.dpop_jkt);
    assert.equal(proof.payload.htm, 'GET');
    assert.equal(proof.payload.htu, url.split('?')[0]);
    assert.equal(proof.payload.ath, athOf(grant.access_token));
    assert.equal(proof.payload.nonce, 'server-nonce-1');
  }
  assert.notEqual(proofs[0].payload.jti, proofs[1].payload.jti);
  assert.equal(
    proofs[1].payload.htu,
    `https://${ORG_CORE}/services/data/v62.0/query/01g-2000`
  );
});

test('a 401 on a bound connection refreshes once and signs with the new token', async () => {
  let rejected = false;
  const salesforce = installSalesforce({
    onApi: async () => {
      if (!rejected) {
        rejected = true;
        return jsonResponse(401, [{ errorCode: 'INVALID_AUTH_HEADER' }]);
      }
      return jsonResponse(200, { records: [{ Id: '1' }] });
    },
  });
  const auth = await loadAuth();
  const grant = await login(auth);
  salesforce.token.calls.length = 0;
  salesforce.token.nonce = 'server-nonce-2';
  const { SalesforceConnection } = await loadConnection();
  const { readProof } = await import('./helpers/dpop.js');

  const records = await new SalesforceConnection({
    instanceUrl: grant.instance_url,
    token: grant,
  }).query('SELECT Id FROM User');

  assert.deepEqual(records, [{ Id: '1' }]);
  assert.equal(salesforce.token.calls.length, 2);
  const fresh = storedToken(ORG);
  const retry = salesforce.apiCalls[1].init.headers;
  assert.equal(retry.Authorization, `DPoP ${fresh.access_token}`);
  const proof = await readProof(retry.DPoP);
  assert.equal(proof.payload.ath, athOf(fresh.access_token));
  assert.equal(proof.payload.nonce, 'server-nonce-2');
});

test('a bound token is never sent as a bearer token when its key is missing', async () => {
  const salesforce = installSalesforce({
    onApi: async () => jsonResponse(200, { records: [] }),
  });
  const auth = await loadAuth();
  const grant = await login(auth);
  idb.clear();
  const { SalesforceConnection, isAuthRefreshFailedError } =
    await loadConnection();

  await assert.rejects(
    new SalesforceConnection({
      instanceUrl: grant.instance_url,
      token: grant,
    }).query('SELECT Id FROM User'),
    (error) => isAuthRefreshFailedError(error)
  );
  assert.equal(salesforce.apiCalls.length, 0);
});

test('a bearer connection keeps sending the Bearer scheme without a proof', async () => {
  const salesforce = installSalesforce({
    onApi: async () => jsonResponse(200, { records: [] }),
  });
  const { SalesforceConnection } = await loadConnection();

  await new SalesforceConnection({
    instanceUrl: `https://${ORG_CORE}`,
    accessToken: 'bearer-access',
  }).query('SELECT Id FROM User');

  const { headers, redirect } = salesforce.apiCalls[0].init;
  assert.equal(headers.Authorization, 'Bearer bearer-access');
  assert.equal(headers.DPoP, undefined);
  assert.equal(redirect, 'error');
});

test('credentials are refused for a URL outside the issuing org', async () => {
  installSalesforce();
  const auth = await loadAuth();
  const grant = await login(auth);
  const { buildAuthorizationHeaders } =
    await import('../src/background/auth/requestAuthorization.js');

  await assert.rejects(
    buildAuthorizationHeaders(
      grant,
      'GET',
      `https://${OTHER_CORE}/services/data/v62.0/limits`
    ),
    /another origin/
  );
  await assert.rejects(
    buildAuthorizationHeaders(
      { access_token: 'bearer', instance_url: `https://${ORG_CORE}` },
      'GET',
      'https://evil.example/services/data'
    ),
    /another origin/
  );
});

test('UI bridge signs a bound grant and returns the one-time frontdoor URL', async () => {
  const frontdoor = `https://${ORG_CORE}/secur/frontdoor.jsp?otp=one-time&startURL=%2Flightning%2Fpage%2Fhome`;
  const salesforce = installSalesforce({
    onApi: async () => jsonResponse(200, { frontdoor_uri: frontdoor }),
  });
  const auth = await loadAuth();
  const grant = await login(auth);
  const { requestFrontdoorUrl } = await loadBridge();
  const { readProof } = await import('./helpers/dpop.js');

  const url = await requestFrontdoorUrl(
    grant,
    '/servlet/servlet.su?oid=00D&suorgadminid=005'
  );

  assert.equal(url, frontdoor);
  assert.equal(url.includes(grant.access_token), false);
  const [{ url: requested, init }] = salesforce.apiCalls;
  assert.equal(requested, `https://${ORG_CORE}/services/oauth2/singleaccess`);
  assert.equal(init.method, 'POST');
  assert.equal(init.redirect, 'error');
  assert.equal(init.headers.Authorization, `DPoP ${grant.access_token}`);
  assert.equal(
    new URLSearchParams(init.body).get('redirect_uri'),
    '/servlet/servlet.su?oid=00D&suorgadminid=005'
  );
  assert.equal(new URLSearchParams(init.body).has('access_token'), false);
  const proof = await readProof(init.headers.DPoP);
  assert.equal(proof.valid, true);
  assert.equal(proof.payload.htm, 'POST');
  assert.equal(proof.payload.htu, requested);
  assert.equal(proof.payload.ath, athOf(grant.access_token));
  assert.equal(proof.payload.nonce, grant.dpop_nonce);
});

test('UI bridge sends a bearer grant with the Bearer scheme', async () => {
  const frontdoor = `https://${ORG_CORE}/secur/frontdoor.jsp?otp=one-time`;
  const salesforce = installSalesforce({
    onApi: async () => jsonResponse(200, { frontdoor_uri: frontdoor }),
  });
  const { requestFrontdoorUrl } = await loadBridge();

  const url = await requestFrontdoorUrl(
    {
      access_token: 'bearer-access',
      instance_url: `https://${ORG_CORE}`,
      token_type: 'Bearer',
    },
    '/lightning/page/home'
  );

  assert.equal(url, frontdoor);
  const { headers } = salesforce.apiCalls[0].init;
  assert.equal(headers.Authorization, 'Bearer bearer-access');
  assert.equal(headers.DPoP, undefined);
});

test('UI bridge rejects unsafe redirect paths, foreign frontdoor URLs, and failures without leaking credentials', async () => {
  const bearer = {
    access_token: 'bearer-access',
    instance_url: `https://${ORG_CORE}`,
  };
  const { requestFrontdoorUrl, isRelativePath } = await loadBridge();
  let response = jsonResponse(200, {
    frontdoor_uri: 'https://evil.example/secur/frontdoor.jsp?otp=1',
  });
  const salesforce = installSalesforce({ onApi: async () => response });

  for (const path of [
    'https://evil.example/',
    '//evil.example',
    '/\\evil.example',
    '/ok\\..\\evil',
    '/line\nbreak',
    '',
    null,
  ]) {
    assert.equal(isRelativePath(path), false);
    await assert.rejects(requestFrontdoorUrl(bearer, path), /relative/);
  }
  assert.equal(salesforce.apiCalls.length, 0);

  await assert.rejects(
    requestFrontdoorUrl(bearer, '/lightning/page/home'),
    /unexpected URL/
  );
  response = jsonResponse(200, {
    frontdoor_uri: `https://${ORG_CORE}/other/page?otp=1`,
  });
  await assert.rejects(
    requestFrontdoorUrl(bearer, '/lightning/page/home'),
    /unexpected URL/
  );
  for (const unsafe of [
    `https://${ORG_CORE}/secur/frontdoor.jsp?sid=session-id`,
    `https://user:pass@${ORG_CORE}/secur/frontdoor.jsp?otp=1`,
  ]) {
    response = jsonResponse(200, { frontdoor_uri: unsafe });
    await assert.rejects(
      requestFrontdoorUrl(bearer, '/lightning/page/home'),
      /unexpected URL/
    );
  }
  response = new Response('otp=one-time-secret is not json', { status: 200 });
  await assert.rejects(
    requestFrontdoorUrl(bearer, '/lightning/page/home'),
    /^Error: UI session bridge returned an unreadable response$/
  );
  response = jsonResponse(200, { frontdoor_uri: 'not a url otp=secret' });
  await assert.rejects(
    requestFrontdoorUrl(bearer, '/lightning/page/home'),
    /^Error: UI session bridge returned an unreadable response$/
  );
  response = new Response('Bad_OAuth_Token', { status: 403 });
  await assert.rejects(
    requestFrontdoorUrl(bearer, '/lightning/page/home'),
    /^Error: UI session bridge failed: 403 Bad_OAuth_Token$/
  );
  response = new Response(
    `{"otp":"one-time","nonce":"n1"} https://${ORG_CORE}/x?sid=secret-session access_token=bearer-access`,
    { status: 403 }
  );
  await assert.rejects(
    requestFrontdoorUrl(bearer, '/lightning/page/home'),
    /^Error: UI session bridge failed: 403 unreadable response$/
  );
});
