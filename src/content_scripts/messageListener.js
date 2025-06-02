/**
 * Handles incoming messages from the background script and dispatches actions.
 * @param {object} message Message payload containing action.
 * @param {chrome.runtime.MessageSender} sender Sender of the message.
 * @param {function} sendResponse Callback to send the response asynchronously.
 * @returns {boolean} True if the response will be sent asynchronously, false otherwise.
 */
export function handleMessage(message, sender, sendResponse) {
  console.log('Received message in content script:', message);
  try {
    switch (message.action) {
      case 'toggleCommandPalette':
        handleToggleCommandPallet().then((response) => sendResponse(response));
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

/**
 * Toggles the command palette visibility in the LWC application.
 * @private
 * @returns {Promise<{success: boolean}>} Result indicating if the toggle was successful.
 */
async function handleToggleCommandPallet() {
  const appElement = document.querySelector('x-app');
  if (appElement && typeof appElement.toggleCommandPallet === 'function') {
    appElement.toggleCommandPallet();
    return { success: true };
  }
}
