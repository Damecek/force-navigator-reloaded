import CacheManager from './cacheManager.js';
import { COMMAND_USAGE_KEY, GLOBAL_CACHE_SCOPE } from './constants.js';

export default class UsageTracker {
  static _tracker = null;
  _usageMap = null;

  constructor() {
    console.log('UsageTracker initialized');
    this.cache = new CacheManager(GLOBAL_CACHE_SCOPE);
  }

  static async instance() {
    if (!this._tracker) {
      this._tracker = new UsageTracker();
    }
    return this._tracker;
  }

  async usageMap() {
    if (this._usageMap === null) {
      console.log('Loading command usage map from cache');
      this._usageMap = (await this.cache.get(COMMAND_USAGE_KEY)) || {};
    }
    return this._usageMap;
  }

  async getUsage(id) {
    return (await this.usageMap())[id] || 0;
  }

  async incrementUsage(id) {
    console.log(`Incrementing usage for command ${id}`);
    const map = await this.usageMap();
    const count = (map[id] || 0) + 1;
    map[id] = count;
    await this.cache.set(COMMAND_USAGE_KEY, map);
    return count;
  }

  resetUsage() {
    console.log('Resetting command usage map');
    this._usageMap = null;
    return this.cache.clear(COMMAND_USAGE_KEY);
  }
}
