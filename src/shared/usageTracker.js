import CacheManager from './cacheManager.js';
import {
  COMMAND_ACTIVITY_KEY,
  COMMAND_USAGE_KEY,
  GLOBAL_CACHE_SCOPE,
} from './constants.js';

const MAX_ACTIVE_DATES = 10;

export default class UsageTracker {
  static _tracker = null;
  _usageMap = null;
  _activity = null;

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

  /**
   * Increment a command count without dropping an intentional display seed.
   * @param {string} id
   * @param {Date} [date]
   * @param {number} [seedUsage]
   * @returns {Promise<number>}
   */
  async incrementUsage(id, date = new Date(), seedUsage = 0) {
    console.log(`Incrementing usage for command ${id}`);
    const map = await this.usageMap();
    const normalizedSeed =
      Number.isInteger(seedUsage) && seedUsage > 0 ? seedUsage : 0;
    const count = Math.max(map[id] || 0, normalizedSeed) + 1;
    map[id] = count;
    await this.cache.set(COMMAND_USAGE_KEY, map);
    await this.trackActiveDate(date);
    return count;
  }

  async activity() {
    if (this._activity === null) {
      console.log('Loading command activity from cache');
      const stored = await this.cache.get(COMMAND_ACTIVITY_KEY);
      this._activity =
        stored &&
        typeof stored === 'object' &&
        Array.isArray(stored.activeDates)
          ? { activeDates: stored.activeDates.filter(isDateKey) }
          : { activeDates: [] };
    }
    return this._activity;
  }

  async trackActiveDate(date = new Date()) {
    const activity = await this.activity();
    const today = formatLocalDateKey(date);
    const activeDates = Array.from(new Set([...activity.activeDates, today]))
      .filter(isDateKey)
      .sort()
      .slice(-MAX_ACTIVE_DATES);
    activity.activeDates = activeDates;
    await this.cache.set(COMMAND_ACTIVITY_KEY, activity, { preserve: true });
    return activeDates;
  }

  async activeDateCount() {
    const activity = await this.activity();
    return activity.activeDates.length;
  }

  async totalUsage() {
    const map = await this.usageMap();
    return Object.values(map).reduce(
      (total, value) => total + (typeof value === 'number' ? value : 0),
      0
    );
  }

  async resetUsage() {
    console.log('Resetting command usage map');
    this._usageMap = null;
    this._activity = null;
    await this.cache.clear(COMMAND_USAGE_KEY);
    await this.cache.clear(COMMAND_ACTIVITY_KEY);
  }
}

function formatLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isDateKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}
