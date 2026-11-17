/**
 * Persists DPoP signing keys in IndexedDB of the current browser profile.
 * IndexedDB stores the non-extractable CryptoKey itself, so the private key
 * material is never serialized, synced, or readable by extension code.
 */

const DATABASE_NAME = 'forceNavigatorDpop';
const STORE_NAME = 'keys';

/**
 * @typedef {import('./dpopProof.js').DpopKey} DpopKey
 */

/**
 * Store the key of a bound grant for one org.
 * @param {string} scope Canonical Lightning hostname that owns the grant.
 * @param {DpopKey} key
 * @returns {Promise<void>}
 */
export function saveDpopKey(scope, { thumbprint, privateKey, publicJwk }) {
  return withStore('readwrite', (store) => {
    store.put({ thumbprint, scope, privateKey, publicJwk });
  });
}

/**
 * Load a key by thumbprint. A key stored for another org is not returned.
 * @param {string} thumbprint
 * @param {string} scope Canonical Lightning hostname that owns the grant.
 * @returns {Promise<DpopKey|null>}
 */
export async function loadDpopKey(thumbprint, scope) {
  if (typeof thumbprint !== 'string' || !thumbprint) {
    return null;
  }
  const record = await withStore('readonly', (store, resolve) => {
    const request = store.get(thumbprint);
    request.onsuccess = () => resolve(request.result);
  });
  if (!record?.privateKey || !record.publicJwk || record.scope !== scope) {
    return null;
  }
  return {
    thumbprint: record.thumbprint,
    privateKey: record.privateKey,
    publicJwk: record.publicJwk,
  };
}

/**
 * Delete one key.
 * @param {string} thumbprint
 * @returns {Promise<void>}
 */
export function deleteDpopKey(thumbprint) {
  return withStore('readwrite', (store) => {
    store.delete(thumbprint);
  });
}

/**
 * Delete every key of an org except the one its stored grant uses.
 * @param {string} scope Canonical Lightning hostname.
 * @param {string|null} keepThumbprint Key of the current grant, or null to delete all.
 * @returns {Promise<void>}
 */
export function pruneDpopKeys(scope, keepThumbprint) {
  return withStore('readwrite', (store) => {
    const request = store.getAll();
    request.onsuccess = () => {
      for (const record of request.result) {
        if (record.scope === scope && record.thumbprint !== keepThumbprint) {
          store.delete(record.thumbprint);
        }
      }
    };
  });
}

/**
 * @returns {Promise<IDBDatabase>}
 */
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: 'thumbprint' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Run requests in one transaction and settle when it commits.
 * @template T
 * @param {IDBTransactionMode} mode
 * @param {(store: IDBObjectStore, resolve: (value: T) => void) => void} operate
 * @returns {Promise<T|undefined>}
 */
async function withStore(mode, operate) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      let result;
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
      operate(transaction.objectStore(STORE_NAME), (value) => {
        result = value;
      });
    });
  } finally {
    database.close();
  }
}
