import { getCommands } from '../commandRegister.js';

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
        sendCommands(sender).then((response) => sendResponse(response));
        return true;
      default:
        console.error('Unknown message action:', message.action);
    }
  } catch (error) {
    console.error(
      `MessageListener: error handling message ${message.action}`,
      error
    );
  }
  return false;
}

async function sendCommands(sender) {
  let hostname;
  try {
    hostname = sender.tab && new URL(sender.tab.url).hostname;
  } catch {
    hostname = null;
  }
  const commands = hostname ? await getCommands(hostname) : [];
  console.log('Commands to send:', commands);
  return { commands };
}
