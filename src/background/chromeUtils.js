/**
 * Retrieves the currently active tab in the current window.
 * @async
 * @returns {Promise<chrome.tabs.Tab>} Active tab object.
 */
export async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/**
 * Sends a message to a specified tab, or to the current active tab if no tabId is provided.
 * @async
 * @param {object} message Message payload to send.
 * @param {number} [tabId] Optional tab ID to send the message to.
 * @returns {Promise<void>}
 */
export async function sendTabMessage(message, tabId) {
  const targetId = tabId || (await getCurrentTab()).id;
  await chrome.tabs.sendMessage(targetId, message);
}
