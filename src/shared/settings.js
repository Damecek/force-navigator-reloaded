/* global chrome */
import {
  COMMANDS_SETTINGS_KEY,
  PERSONAL_SETTING_SETUP_NODE,
  SERVICE_SETUP_SETUP_NODE,
  SETUP_NODE_TYPES,
  SETUP_SETUP_NODE,
} from './constants.js';

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
  return merged;
}

/**
 * Load settings from storage. Missing values are filled with defaults.
 * @returns {Promise<typeof DEFAULT_SETTINGS>}
 */
export async function loadSettings() {
  const stored = (await chrome.storage.local.get(SETTINGS_KEY))[SETTINGS_KEY];
  const settings = mergeSettings(stored);
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  return settings;
}

/**
 * Save provided settings to storage.
 * @param {typeof DEFAULT_SETTINGS} settings
 * @returns {Promise<void>}
 */
export async function saveSettings(settings) {
  const merged = mergeSettings(settings);
  await chrome.storage.local.set({ [SETTINGS_KEY]: merged });
}

/**
 * Reset user settings to defaults.
 * @returns {Promise<typeof DEFAULT_SETTINGS>}
 */
export async function resetSettings() {
  await chrome.storage.local.remove(SETTINGS_KEY);
  return loadSettings();
}

/**
 * Get value from settings by key.
 * @param {string[]} keyPath
 * @return {Promise<any>}
 */
export async function getSetting(keyPath) {
  const settings = await loadSettings();
  return keyPath.reduce((acc, key) => {
    if (acc && Object.prototype.hasOwnProperty.call(acc, key)) {
      return acc[key];
    }
    return undefined;
  }, settings);
}
