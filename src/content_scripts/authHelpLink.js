import { Channel, CHANNEL_OPEN_AUTH_HELP } from '../shared/index.js';
import { OPEN_AUTH_HELP_EVENT } from './lightningToastBridge.js';

/**
 * Open the extension's authorization help page in a new tab.
 * @returns {Promise<void>}
 */
export async function openAuthHelp() {
  try {
    await new Channel(CHANNEL_OPEN_AUTH_HELP).publish();
  } catch (error) {
    console.error('Failed to open authorization help', error);
  }
}

/**
 * Forward help-link clicks from page-context toasts to the background.
 * @returns {void}
 */
export function registerAuthHelpLinkListener() {
  document.addEventListener(OPEN_AUTH_HELP_EVENT, (event) => {
    event.preventDefault();
    void openAuthHelp();
  });
}
