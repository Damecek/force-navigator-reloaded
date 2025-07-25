/* global chrome */
/**
 * CacheManager handles storing and retrieving cached data.
 * Supports optional TTL (time-to-live). If no TTL is provided the entry never expires.
 * Uses chrome.storage.local under the hood.
 */
export default class CacheManager {
  /**
   * @param {string} scope
   */
  constructor(scope) {
    this.scope = scope;
  }

  _getDomainKey(key) {
    return `${this.scope}_${key}`;
  }

  /**
   * Retrieve cached entry by key if not expired.
   * @param {string} key
   * @returns {Promise<any|null>}
   */
  async get(key) {
    const cacheKey = [this._getDomainKey(key)];
    const entry = (await chrome.storage.local.get(cacheKey))[cacheKey];
    console.log('Cached', ...cacheKey, entry);
    if (!entry || !('value' in entry)) {
      return null;
    }
    if (typeof entry.timestamp === 'number' && Date.now() > entry.timestamp) {
      console.log('Cache expired', new Date(entry.timestamp), key);
      await this.clear(key);
      return null;
    }
    return entry.value;
  }

  /**
   * @typedef {Object} SetOptions
   * @property {number} [ttl] - Time to live in milliseconds. If provided, the entry will expire after this time.
   * @property {boolean} [preserve] - If true, the entry will not be cleared on storage cleanup. Defaults to false.
   */

  /**
   * Clear all cached entries in chrome.storage.local except those marked as `preserve`.
   * @returns {Promise<void>}
   */
  static async clearAll() {
    console.log('Clearing all cache entries');
    const items = await chrome.storage.local.get();
    const toRemove = Object.keys(items).filter((key) => !items[key].preserve);
    if (toRemove.length > 0) {
      console.log('Removing non-preserved cache entries:', toRemove);
      return chrome.storage.local.remove(toRemove);
    }
    console.log('No non-preserved cache entries to remove');
  }

  /**
   * Remove cached entry by key.
   * @param {string} key
   * @returns {Promise<void>}
   */
  async clear(key) {
    const cacheKey = this._getDomainKey(key);
    console.log('Clearing', cacheKey);
    return chrome.storage.local.remove([cacheKey]);
  }

  /**
   * Store a value under key. If ttl is provided, the entry will expire after ttl
   * milliseconds. If omitted (undefined/null) the entry never expires.
   *
   * @param {string} key
   * @param {any} value
   * @param {SetOptions} [options] - Options for setting the cache entry.
   * @returns {Promise<void>}
   */
  async set(key, value, { ttl, preserve } = {}) {
    const entry = { value, preserve: !!preserve };

    if (typeof ttl === 'number' && ttl > 0) {
      entry.timestamp = Date.now() + ttl;
    }

    const domainKey = this._getDomainKey(key);
    const cacheRecord = { [domainKey]: entry };
    console.log('Caching', domainKey, entry);
    return chrome.storage.local.set(cacheRecord);
  }
}
