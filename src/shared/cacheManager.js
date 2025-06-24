/* global chrome */
/**
 * CacheManager handles storing and retrieving cached data.
 * Supports optional TTL (time-to-live). If no TTL is provided the entry never expires.
 * Uses chrome.storage.local under the hood.
 */
export default class CacheManager {
  /**
   * @param {string} domain
   */
  constructor(domain) {
    this.domain = domain;
  }

  getDomainKey(key) {
    return `${this.domain}_${key}`;
  }

  /**
   * Retrieve cached entry by key if not expired.
   * @param {string} key
   * @returns {Promise<any|null>}
   */
  async get(key) {
    const cacheKey = [this.getDomainKey(key)];
    const entry = (await chrome.storage.local.get(cacheKey))[cacheKey];
    console.log('Cached', cacheKey, entry);
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
   * Store a value under key. If ttl is provided, the entry will expire after ttl
   * milliseconds. If omitted (undefined/null) the entry never expires.
   *
   * @param {string} key
   * @param {any} value
   * @param {number} [ttl] Time-to-live in ms (optional)
   * @returns {Promise<void>}
   */
  async set(key, value, ttl) {
    const entry = { value };

    if (typeof ttl === 'number' && ttl > 0) {
      entry.timestamp = Date.now() + ttl;
    }

    const cacheRecord = { [this.getDomainKey(key)]: entry };
    console.log('Caching', cacheRecord);
    return chrome.storage.local.set(cacheRecord);
  }

  /**
   * Remove cached entry by key.
   * @param {string} key
   * @returns {Promise<void>}
   */
  async clear(key) {
    const cacheKey = this.getDomainKey(key);
    console.log('Clearing', cacheKey);
    return chrome.storage.local.remove([cacheKey]);
  }
}
