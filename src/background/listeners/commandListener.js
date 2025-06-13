import { sendTabMessage } from '../chromeUtils';
import {
  CHANNEL_TOGGLE_COMMAND_PALETTE,
  isContentScriptAllowedDomain,
} from '../../shared';

/**
 * Handles keyboard commands defined in the manifest and forwards them to content scripts
 * only for allowed base domains.
 *
 * @param {string} command The name of the command triggered.
 * @param {chrome.tabs.Tab} tab The tab object.
 */
export async function handleCommand(command, tab) {
  const url = tab?.url;
  if (!url || !isContentScriptAllowedDomain(url)) {
    console.log(`handleCommand: ignored command "${command}" on URL: ${url}`);
    return;
  }
  console.log('Received command:', command);
  switch (command) {
    case 'toggle-command-palette':
      await handleToggleCommandPalette(tab?.id);
      break;
    default:
      console.error('Unknown command:', command);
  }
}

async function handleToggleCommandPalette(tabId) {
  await sendTabMessage({ action: CHANNEL_TOGGLE_COMMAND_PALETTE }, tabId);
}
