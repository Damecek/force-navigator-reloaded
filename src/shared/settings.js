/* global chrome */
import {
  SETUP_SETUP_NODE,
  PERSONAL_SETTING_SETUP_NODE,
  SERVICE_SETUP_SETUP_NODE,
} from './constants.js';

/**
 * Key used for persisting settings in chrome.storage.
 */
export const SETTINGS_KEY = 'settings';

/**
 * Default extension settings.
 */
export const DEFAULT_SETTINGS = {
  setupNodeTypes: {
    [SETUP_SETUP_NODE]: true,
    [PERSONAL_SETTING_SETUP_NODE]: true,
    [SERVICE_SETUP_SETUP_NODE]: false,
  },
};

function mergeSettings(partial) {
  const merged = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  if (partial && typeof partial === 'object') {
    if (partial.setupNodeTypes && typeof partial.setupNodeTypes === 'object') {
      Object.assign(merged.setupNodeTypes, partial.setupNodeTypes);
    }
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
 * Derive configured setup node types from settings.
 * @param {typeof DEFAULT_SETTINGS} settings
 * @returns {string[]}
 */
export function getSetupNodeTypesFrom(settings) {
  return Object.entries(settings.setupNodeTypes)
    .filter(([, enabled]) => Boolean(enabled))
    .map(([node]) => node);
}
