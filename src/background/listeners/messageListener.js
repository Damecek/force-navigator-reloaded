import { getCommands } from '../commandRegister.js';
import { interactiveLogin } from '../auth/auth';

/**
 * Generic message listener for background script.
 * Routes messages by action type and responds asynchronously.
 *
 * In async `then` sends response.
 * @returns {boolean} true if message was handled, false otherwise
 */
export function handleMessage(message, sender, sendResponse) {
  console.log('Received message in background script:', message);
  try {
    switch (message.action) {
      case 'getCommands':
        sendCommands(sender).then((response) =>
          chrome.tabs.sendMessage(sender.tab.id, {
            action: 'sendCommands',
            data: response,
          })
        );
        return false;
      case 'invokeAuthFlow':
        invokeAuthFlow(sender).then((response) => sendResponse(response));
        return true;
      default:
        console.error('Unknown message action:', message.action);
    }
  } catch (error) {
    console.error(
      `MessageListener: error handling message ${message?.action}`,
      error
    );
  }
  return false;
}

function getSenderHostname(sender) {
  try {
    return sender.tab && new URL(sender.tab.url).hostname;
  } catch {
    console.error('Failed to get sender hostname', sender);
    return null;
  }
}

async function sendCommands(sender) {
  const hostname = getSenderHostname(sender);
  const commands = hostname ? await getCommands(hostname) : [];
  console.log('Commands to send:', commands);
  return { commands };
}

async function invokeAuthFlow(sender) {
  const hostname = getSenderHostname(sender);
  await interactiveLogin(hostname);
  return {};
}
