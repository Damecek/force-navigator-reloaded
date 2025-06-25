import {
  Channel,
  CHANNEL_COMPLETED_AUTH_FLOW,
  CHANNEL_INVOKE_AUTH_FLOW,
  CHANNEL_REFRESH_COMMANDS,
  CHANNEL_SEND_COMMANDS,
  CHANNEL_TOGGLE_COMMAND_PALETTE,
  isContentScriptAllowedDomain,
} from '../shared';
import { getCommands } from './commandRegister';
import { interactiveLogin } from './auth/auth';

chrome.commands.onCommand.addListener((command, tab) => {
  const url = tab?.url;
  if (!url || !isContentScriptAllowedDomain(url)) {
    console.log(`handleCommand: ignored command "${command}" on URL: ${url}`);
    return;
  }
  console.log('Received command:', command);
  switch (command) {
    case 'toggle-command-palette':
      return new Channel(CHANNEL_TOGGLE_COMMAND_PALETTE).publish({
        tabId: tab.id,
      });
    default:
      console.error('Unknown command:', command);
  }
});

/**
 * Sending commands back through different channel as the publisher of CHANNEL_REFRESH_COMMANDS does not need to be the handler of the commands.
 */
new Channel(CHANNEL_REFRESH_COMMANDS).subscribe(async ({ sender }) => {
  const hostname = getSenderHostname(sender);
  const commands = hostname ? await getCommands(hostname) : [];
  console.log('Commands to send:', commands);
  return new Channel(CHANNEL_SEND_COMMANDS).publish({
    data: commands,
    tabId: sender.tab.id,
  });
});

new Channel(CHANNEL_INVOKE_AUTH_FLOW).subscribe(async ({ sender }) => {
  const hostname = getSenderHostname(sender);
  await interactiveLogin(hostname);
  return new Channel(CHANNEL_COMPLETED_AUTH_FLOW).publish({
    tabId: sender.tab.id,
  });
});

function getSenderHostname(sender) {
  try {
    return sender.tab && new URL(sender.tab.url).hostname;
  } catch {
    console.error('Failed to get sender hostname', sender);
    return null;
  }
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'update' || reason === 'install') {
    console.log('Extension installation detected, clearing cache');
    await chrome.storage.local.clear();
  }
});
