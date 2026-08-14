import {
  COMMAND_PALETTE_SETTINGS_KEY,
  COMMAND_PALETTE_SHOW_USAGE_SETTINGS_KEY,
} from '../../../../../shared/constants.js';

/**
 * Create a disconnectable loader for the command usage presentation setting.
 * @param {{ loadSettings: () => Promise<object>, onResolved: (showUsage: boolean) => void }} options
 * @returns {{ disconnect: () => void, load: () => Promise<void> }}
 */
export function createUsageSettingsLoader({ loadSettings, onResolved }) {
  let isActive = true;

  return {
    disconnect() {
      isActive = false;
    },

    async load() {
      let showUsage = false;

      try {
        const settings = await loadSettings();
        showUsage =
          settings[COMMAND_PALETTE_SETTINGS_KEY]?.[
            COMMAND_PALETTE_SHOW_USAGE_SETTINGS_KEY
          ] === true;
      } catch {
        showUsage = false;
      }

      if (isActive) {
        onResolved(showUsage);
      }
    },
  };
}
