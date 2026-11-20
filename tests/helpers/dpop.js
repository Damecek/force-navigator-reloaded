import { createHash } from 'node:crypto';

const DATABASE = 'forceNavigatorDpop';
const STORE = 'keys';

/**
 * Minimal in-memory IndexedDB covering what the DPoP key store uses.
 * Values keep their object identity, like structured-cloned CryptoKeys.
 */
export function createFakeIndexedDb() {
  const databases = new Map();
  const fake = {
    failWith: null,
    records() {
      return [...(databases.get(DATABASE)?.get(STORE)?.records.values() || [])];
    },
    clear() {
      databases.clear();
    },
    open(name) {
      const request = {};
      queueMicrotask(() => {
        if (fake.failWith) {
          request.error = fake.failWith;
          request.onerror?.();
          return;
        }
        const isNew = !databases.has(name);
        if (isNew) {
          databases.set(name, new Map());
        }
        const stores = databases.get(name);
        request.result = {
          createObjectStore(storeName, { keyPath }) {
            stores.set(storeName, { keyPath, records: new Map() });
          },
          transaction(storeName) {
            return createTransaction(stores.get(storeName));
          },
          close() {},
        };
        if (isNew) {
          request.onupgradeneeded?.();
        }
        request.onsuccess?.();
      });
      return request;
    },
  };
  return fake;
}

function createTransaction({ keyPath, records }) {
  const transaction = {};
  let pending = 0;
  const run = (compute) => {
    const request = {};
    pending += 1;
    queueMicrotask(() => {
      request.result = compute();
      request.onsuccess?.();
      pending -= 1;
      queueMicrotask(() => {
        if (pending === 0) {
          transaction.oncomplete?.();
        }
      });
    });
    return request;
  };
  transaction.objectStore = () => ({
    put: (value) => run(() => void records.set(value[keyPath], value)),
    get: (key) => run(() => records.get(key)),
    delete: (key) => run(() => void records.delete(key)),
    getAll: () => run(() => [...records.values()]),
  });
  return transaction;
}

/** In-memory chrome.storage.local area with optional write failures. */
export function createStorageArea() {
  const records = new Map();
  return {
    records,
    failNextSet: false,
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
      if (this.failNextSet) {
        this.failNextSet = false;
        throw new Error('storage write failed');
      }
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
}

const decodeSegment = (segment) =>
  JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));

/**
 * Decode a DPoP proof and verify its ES256 signature with the embedded key.
 * @param {string} proof
 * @returns {Promise<{header: object, payload: object, valid: boolean}>}
 */
export async function readProof(proof) {
  const [header, payload, signature] = proof.split('.');
  const decodedHeader = decodeSegment(header);
  const publicKey = await crypto.subtle.importKey(
    'jwk',
    decodedHeader.jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify']
  );
  const valid = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    publicKey,
    Buffer.from(signature, 'base64url'),
    new TextEncoder().encode(`${header}.${payload}`)
  );
  return { header: decodedHeader, payload: decodeSegment(payload), valid };
}

/** Independent RFC 7638 thumbprint of an EC public JWK. */
export function thumbprintOf({ crv, kty, x, y }) {
  return createHash('sha256')
    .update(JSON.stringify({ crv, kty, x, y }))
    .digest('base64url');
}

/** Independent `ath` value for an access token. */
export function athOf(accessToken) {
  return createHash('sha256').update(accessToken).digest('base64url');
}

export function jsonResponse(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

/**
 * Simulates the Salesforce token endpoint: a proof without the current nonce
 * gets a `use_dpop_nonce` challenge, every other request reaches `issue`.
 * @param {(request: {body: URLSearchParams, proof: object|null}) => Response|Promise<Response>} issue
 * @returns {{calls: Array<{body: URLSearchParams, proof: object|null, raw: string|undefined}>, nonce: string, handle: (url: string, init: object) => Promise<Response>}}
 */
export function createTokenEndpoint(issue) {
  const endpoint = {
    calls: [],
    nonce: 'server-nonce-1',
    async handle(url, init = {}) {
      const raw = init.headers?.DPoP;
      const proof = raw ? await readProof(raw) : null;
      const call = {
        url,
        body: new URLSearchParams(init.body),
        proof,
        raw,
        redirect: init.redirect,
      };
      endpoint.calls.push(call);
      if (proof && proof.payload.nonce !== endpoint.nonce) {
        return jsonResponse(
          400,
          {
            error: 'use_dpop_nonce',
            error_description:
              'authorization server requires nonce in DPoP proof',
          },
          { 'DPoP-Nonce': endpoint.nonce }
        );
      }
      return issue(call);
    },
  };
  return endpoint;
}
