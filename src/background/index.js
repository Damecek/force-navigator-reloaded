import { handleCommand } from './listeners/commandListener.js';
import {
  Channel,
  CHANNEL_COMPLETED_AUTH_FLOW,
  CHANNEL_GET_COMMANDS,
  CHANNEL_INVOKE_AUTH_FLOW,
  CHANNEL_SEND_COMMANDS,
} from '../shared';
import { getCommands } from './commandRegister';
import { interactiveLogin } from './auth/auth'; /**
 * Background script entry point: commands, and message listeners.
 * @returns {void}
 */

/**
 * Background script entry point: commands, and message listeners.
 * @returns {void}
 */

chrome.commands.onCommand.addListener(handleCommand);

/**
 * Sending commands back through different channel as the publisher of CHANNEL_GET_COMMANDS does not need to be the one needing the commands.
 */
new Channel(CHANNEL_GET_COMMANDS).subscribe(async function ({ sender }) {
  const hostname = getSenderHostname(sender);
  const commands = hostname ? await getCommands(hostname) : [];
  console.log('Commands to send:', commands);
  return new Channel(CHANNEL_SEND_COMMANDS).publish({
    data: commands,
    tabId: sender.tab.id,
  });
});

new Channel(CHANNEL_INVOKE_AUTH_FLOW).subscribe(async function ({ sender }) {
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
