import test from 'node:test';
import assert from 'node:assert/strict';
import {
  athOf,
  createFakeIndexedDb,
  jsonResponse,
  readProof,
  thumbprintOf,
} from './helpers/dpop.js';
import {
  computeJwkThumbprint,
  createDpopProof,
  generateDpopKey,
  isDpopToken,
  normalizeHtu,
  readDpopNonceChallenge,
} from '../src/background/auth/dpop/dpopProof.js';
import {
  deleteDpopKey,
  loadDpopKey,
  pruneDpopKeys,
  saveDpopKey,
} from '../src/background/auth/dpop/dpopKeyStore.js';

const TOKEN_URL = 'https://acme.my.salesforce.com/services/oauth2/token';

test('generated key is ES256, non-extractable, and identified by its RFC 7638 thumbprint', async () => {
  const key = await generateDpopKey();

  assert.equal(key.privateKey.extractable, false);
  assert.deepEqual(key.privateKey.usages, ['sign']);
  await assert.rejects(crypto.subtle.exportKey('jwk', key.privateKey));
  assert.deepEqual(Object.keys(key.publicJwk), ['crv', 'kty', 'x', 'y']);
  assert.equal(key.publicJwk.crv, 'P-256');
  assert.equal(key.thumbprint, thumbprintOf(key.publicJwk));
});

test('thumbprint matches the RFC 7638 form regardless of member order and extra members', async () => {
  const jwk = {
    y: 'YXWanpPri_6o2virYzsAfVNZhAW3SQaxFSBcs89BC-Q',
    kid: 'ignored',
    kty: 'EC',
    alg: 'ES256',
    x: 'vCAiGjuhIeMCTEJq_N9-oJRjPTRENezkoQ5TBaJtK7Y',
    crv: 'P-256',
  };
  assert.equal(await computeJwkThumbprint(jwk), thumbprintOf(jwk));
});

test('token endpoint proof carries the required header and claims with a valid signature', async () => {
  const key = await generateDpopKey();
  const before = Math.floor(Date.now() / 1000);

  const { header, payload, valid } = await readProof(
    await createDpopProof({ key, method: 'post', url: TOKEN_URL })
  );

  assert.equal(valid, true);
  assert.deepEqual(header, {
    typ: 'dpop+jwt',
    alg: 'ES256',
    jwk: key.publicJwk,
  });
  assert.deepEqual(Object.keys(payload).sort(), ['htm', 'htu', 'iat', 'jti']);
  assert.equal(payload.htm, 'POST');
  assert.equal(payload.htu, TOKEN_URL);
  assert.ok(payload.iat >= before && payload.iat <= before + 2);
  assert.match(payload.jti, /^[A-Za-z0-9_-]{22}$/);
});

test('resource proof binds the method, the URL without query, the nonce, and the access token', async () => {
  const key = await generateDpopKey();
  const url =
    'https://acme.my.salesforce.com/services/data/v62.0/query/?q=SELECT+Id+FROM+User#frag';

  const { payload, valid } = await readProof(
    await createDpopProof({
      key,
      method: 'GET',
      url,
      nonce: 'nonce-1',
      accessToken: '00Dxx!access',
    })
  );

  assert.equal(valid, true);
  assert.equal(payload.htm, 'GET');
  assert.equal(
    payload.htu,
    'https://acme.my.salesforce.com/services/data/v62.0/query/'
  );
  assert.equal(payload.nonce, 'nonce-1');
  assert.equal(payload.ath, athOf('00Dxx!access'));
});

test('every proof has a unique jti and a different signature', async () => {
  const key = await generateDpopKey();
  const proofs = await Promise.all(
    Array.from({ length: 20 }, () =>
      createDpopProof({ key, method: 'POST', url: TOKEN_URL })
    )
  );
  const decoded = await Promise.all(proofs.map(readProof));

  assert.equal(new Set(decoded.map((p) => p.payload.jti)).size, 20);
  assert.equal(new Set(proofs).size, 20);
});

test('a proof signed by one key does not verify under another key', async () => {
  const key = await generateDpopKey();
  const other = await generateDpopKey();
  const proof = await createDpopProof({ key, method: 'POST', url: TOKEN_URL });
  const [header, payload, signature] = proof.split('.');
  const forgedHeader = Buffer.from(
    JSON.stringify({ typ: 'dpop+jwt', alg: 'ES256', jwk: other.publicJwk })
  ).toString('base64url');

  assert.equal((await readProof(proof)).valid, true);
  assert.equal(
    (await readProof(`${forgedHeader}.${payload}.${signature}`)).valid,
    false
  );
  assert.notEqual(header, forgedHeader);
});

test('proof creation fails without key material', async () => {
  await assert.rejects(
    createDpopProof({ key: null, method: 'POST', url: TOKEN_URL }),
    /DPoP key is unavailable/
  );
  await assert.rejects(
    createDpopProof({
      key: { publicJwk: {} },
      method: 'POST',
      url: TOKEN_URL,
    }),
    /DPoP key is unavailable/
  );
});

test('normalizeHtu drops query and fragment and keeps the path', () => {
  assert.equal(
    normalizeHtu('https://acme.my.salesforce.com/a/b/?x=1&y=2#z'),
    'https://acme.my.salesforce.com/a/b/'
  );
});

test('isDpopToken recognizes only the DPoP token type', () => {
  assert.equal(isDpopToken({ token_type: 'DPoP' }), true);
  assert.equal(isDpopToken({ token_type: 'dpop' }), true);
  assert.equal(isDpopToken({ token_type: 'Bearer' }), false);
  assert.equal(isDpopToken({}), false);
  assert.equal(isDpopToken(null), false);
});

test('nonce challenge is read only from a 400 use_dpop_nonce error with a valid header', async () => {
  const challenge = (status, body, headers) =>
    readDpopNonceChallenge(jsonResponse(status, body, headers));
  const error = { error: 'use_dpop_nonce' };

  assert.equal(
    await challenge(400, error, { 'DPoP-Nonce': 'nonce-1' }),
    'nonce-1'
  );
  assert.equal(await challenge(401, error, { 'DPoP-Nonce': 'nonce-1' }), null);
  assert.equal(await challenge(400, error), null);
  assert.equal(
    await challenge(
      400,
      { error: 'invalid_grant' },
      { 'DPoP-Nonce': 'nonce-1' }
    ),
    null
  );
  assert.equal(await challenge(200, error, { 'DPoP-Nonce': 'nonce-1' }), null);
  assert.equal(await challenge(500, error, { 'DPoP-Nonce': 'nonce-1' }), null);
  assert.equal(
    await challenge(400, error, { 'DPoP-Nonce': 'x'.repeat(513) }),
    null
  );
  assert.equal(
    await challenge(400, error, { 'DPoP-Nonce': 'has space' }),
    null
  );
  assert.equal(
    await readDpopNonceChallenge(
      new Response('not json', {
        status: 400,
        headers: { 'DPoP-Nonce': 'nonce-1' },
      })
    ),
    null
  );
});

test('nonce challenge leaves the response body readable', async () => {
  const response = jsonResponse(
    400,
    { error: 'invalid_grant' },
    { 'DPoP-Nonce': 'nonce-1' }
  );
  await readDpopNonceChallenge(response);
  assert.equal(await response.text(), '{"error":"invalid_grant"}');
});

test('key store keeps the CryptoKey, isolates orgs, and prunes replaced keys', async () => {
  globalThis.indexedDB = createFakeIndexedDb();
  const first = await generateDpopKey();
  const second = await generateDpopKey();
  const other = await generateDpopKey();
  await saveDpopKey('acme.lightning.force.com', first);
  await saveDpopKey('acme.lightning.force.com', second);
  await saveDpopKey('beta.lightning.force.com', other);

  const loaded = await loadDpopKey(
    first.thumbprint,
    'acme.lightning.force.com'
  );
  assert.equal(loaded.privateKey, first.privateKey);
  assert.deepEqual(loaded.publicJwk, first.publicJwk);
  assert.equal(
    await loadDpopKey(first.thumbprint, 'beta.lightning.force.com'),
    null
  );
  assert.equal(await loadDpopKey('unknown', 'acme.lightning.force.com'), null);
  assert.equal(await loadDpopKey(undefined, 'acme.lightning.force.com'), null);

  await pruneDpopKeys('acme.lightning.force.com', second.thumbprint);
  assert.deepEqual(
    globalThis.indexedDB
      .records()
      .map((record) => record.thumbprint)
      .sort(),
    [second.thumbprint, other.thumbprint].sort()
  );

  await deleteDpopKey(second.thumbprint);
  await pruneDpopKeys('beta.lightning.force.com', null);
  assert.deepEqual(globalThis.indexedDB.records(), []);
});

test('key store reports storage failures instead of treating the key as missing', async () => {
  globalThis.indexedDB = createFakeIndexedDb();
  globalThis.indexedDB.failWith = new Error('idb unavailable');
  await assert.rejects(
    loadDpopKey('thumbprint', 'acme.lightning.force.com'),
    /idb unavailable/
  );
});
