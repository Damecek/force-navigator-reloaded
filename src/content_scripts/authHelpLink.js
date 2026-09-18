import { Channel, CHANNEL_OPEN_AUTH_HELP } from '../shared/index.js';
import { OPEN_AUTH_HELP_EVENT } from './lightningToastBridge.js';

let armedOpenings = 0;

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
 * Allow the next page-context help-link click to open the extension help page.
 * Called when the extension itself renders a toast with the help link, so a
 * host-page script cannot open extension tabs at will. Each armed opening is
 * consumed by one click; further clicks follow the link's public URL.
 * @returns {void}
 */
export function armAuthHelpLink() {
  armedOpenings = 1;
}

/**
 * Forward help-link clicks from page-context toasts to the background while an
 * opening is armed.
 * @returns {void}
 */
export function registerAuthHelpLinkListener() {
  document.addEventListener(OPEN_AUTH_HELP_EVENT, (event) => {
    if (armedOpenings <= 0) {
      return;
    }
    armedOpenings -= 1;
    event.preventDefault();
    void openAuthHelp();
  });
}
