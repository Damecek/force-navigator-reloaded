/* global chrome */
import {
  COMMANDS_SETTINGS_KEY,
  CUSTOM_METADATA_ENTITY_TYPE,
  ENTITY_DEFINITION_SETTINGS_KEY,
  FLOW_ACTIVE_VERSION_TYPE,
  FLOW_DEFINITION_SETTINGS_KEY,
  FLOW_DEFINITION_TYPE,
  FLOW_LATEST_VERSION_TYPE,
  GLOBAL_CACHE_SCOPE,
  PERSONAL_SETTING_SETUP_NODE,
  SERVICE_SETUP_SETUP_NODE,
  SETUP_NODE_TYPES,
  SETUP_SETUP_NODE,
  SOBJECT_APEX_TRIGGERS_ENTITY_TYPE,
  SOBJECT_BUTTONS_LINKS_ACTIONS_ENTITY_TYPE,
  SOBJECT_COMPACT_LAYOUTS_ENTITY_TYPE,
  SOBJECT_ENTITY_TYPE,
  SOBJECT_FIELD_SETS_ENTITY_TYPE,
  SOBJECT_FIELDS_RELATIONSHIPS_ENTITY_TYPE,
  SOBJECT_FLOW_TRIGGERS_ENTITY_TYPE,
  SOBJECT_LIGHTNING_PAGES_ENTITY_TYPE,
  SOBJECT_LIMITS_ENTITY_TYPE,
  SOBJECT_OBJECT_ACCESS_ENTITY_TYPE,
  SOBJECT_PAGE_LAYOUTS_ENTITY_TYPE,
  SOBJECT_RECORD_TYPES_ENTITY_TYPE,
  SOBJECT_RELATED_LOOKUP_FILTERS_ENTITY_TYPE,
  SOBJECT_SEARCH_LAYOUTS_ENTITY_TYPE,
  SOBJECT_VALIDATION_RULES_ENTITY_TYPE,
} from './constants.js';
import { CacheManager } from './index';

/**
 * Key used for persisting settings in chrome.storage.
 */
export const SETTINGS_KEY = 'settings';

/**
 * Default extension settings.
 */
export const DEFAULT_SETTINGS = {
  [COMMANDS_SETTINGS_KEY]: {
    [SETUP_NODE_TYPES]: {
      [SETUP_SETUP_NODE]: true,
      [PERSONAL_SETTING_SETUP_NODE]: true,
      [SERVICE_SETUP_SETUP_NODE]: false,
    },
    [ENTITY_DEFINITION_SETTINGS_KEY]: {
      [CUSTOM_METADATA_ENTITY_TYPE]: true,
      [SOBJECT_ENTITY_TYPE]: {
        [SOBJECT_FIELDS_RELATIONSHIPS_ENTITY_TYPE]: true,
        [SOBJECT_PAGE_LAYOUTS_ENTITY_TYPE]: false,
        [SOBJECT_LIGHTNING_PAGES_ENTITY_TYPE]: true,
        [SOBJECT_BUTTONS_LINKS_ACTIONS_ENTITY_TYPE]: true,
        [SOBJECT_COMPACT_LAYOUTS_ENTITY_TYPE]: false,
        [SOBJECT_FIELD_SETS_ENTITY_TYPE]: false,
        [SOBJECT_LIMITS_ENTITY_TYPE]: false,
        [SOBJECT_RECORD_TYPES_ENTITY_TYPE]: true,
        [SOBJECT_RELATED_LOOKUP_FILTERS_ENTITY_TYPE]: false,
        [SOBJECT_SEARCH_LAYOUTS_ENTITY_TYPE]: false,
        [SOBJECT_OBJECT_ACCESS_ENTITY_TYPE]: false,
        [SOBJECT_APEX_TRIGGERS_ENTITY_TYPE]: true,
        [SOBJECT_FLOW_TRIGGERS_ENTITY_TYPE]: true,
        [SOBJECT_VALIDATION_RULES_ENTITY_TYPE]: true,
      },
    },
    [FLOW_DEFINITION_SETTINGS_KEY]: {
      [FLOW_DEFINITION_TYPE]: true,
      [FLOW_LATEST_VERSION_TYPE]: true,
      [FLOW_ACTIVE_VERSION_TYPE]: true,
    },
  },
};

function mergeSettings(partial) {
  const merged = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

  function recursiveAssign(target, source) {
    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        if (
          source[key] &&
          typeof source[key] === 'object' &&
          !Array.isArray(source[key]) &&
          target[key] &&
          typeof target[key] === 'object' &&
          !Array.isArray(target[key])
        ) {
          recursiveAssign(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
    }
  }

  if (partial && typeof partial === 'object') {
    recursiveAssign(merged, partial);
  }
  console.log('Merged settings', merged);
  return merged;
}

/**
 * Load settings from storage. Missing values are filled with defaults.
 * @returns {Promise<typeof DEFAULT_SETTINGS>}
 */
export async function loadSettings() {
  const stored = await new CacheManager(GLOBAL_CACHE_SCOPE).get(SETTINGS_KEY);
  console.log('Loading settings', stored);
  return await saveSettings(stored);
}

/**
 * Save provided settings to storage.
 * @param {typeof DEFAULT_SETTINGS} settings
 * @return {Promise<typeof DEFAULT_SETTINGS>}
 */
export async function saveSettings(settings) {
  console.log('Saving settings', settings);
  const merged = mergeSettings(settings);
  await new CacheManager(GLOBAL_CACHE_SCOPE).set(SETTINGS_KEY, merged, {
    preserve: true,
  });
  return merged;
}

/**
 * Reset user settings to defaults.
 * @returns {Promise<typeof DEFAULT_SETTINGS>}
 */
export async function resetSettings() {
  console.log('Resetting settings to defaults');
  await new CacheManager(GLOBAL_CACHE_SCOPE).clear(SETTINGS_KEY);
  return loadSettings();
}

/**
 * Get value from settings by key.
 * @param {string[]} keyPath
 * @return {Promise<any>}
 */
export async function getSetting(keyPath) {
  console.log('Getting settings for key', keyPath);
  const settings = await loadSettings();
  const value = keyPath.reduce((acc, key) => {
    if (acc && Object.prototype.hasOwnProperty.call(acc, key)) {
      return acc[key];
    }
    return undefined;
  }, settings);
  console.log('Setting value for key', keyPath, value);
  return value;
}
