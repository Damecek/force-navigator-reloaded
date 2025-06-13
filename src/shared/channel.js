/**
 * Simple wrapper around chrome runtime messaging APIs scoped by channel name.
 */
export default class Channel {
  /**
   * @param {string} name Channel identifier used for message action.
   */
  constructor(name) {
    this.name = name;
    this._listeners = new Map();
  }

  /**
   * Subscribe callback to messages of this channel.
   * @param {(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => void} cb
   */
  subscribe(cb) {
    const wrapper = (msg, sender, sendResponse) => {
      if (msg.action !== this.name) {
        return undefined;
      }
      return cb(msg, sender, sendResponse);
    };
    this._listeners.set(cb, wrapper);
    chrome.runtime.onMessage.addListener(wrapper);
  }

  /**
   * Unsubscribe previously registered callback.
   * @param {(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => void} cb
   */
  unsubscribe(cb) {
    const wrapper = this._listeners.get(cb);
    if (wrapper) {
      chrome.runtime.onMessage.removeListener(wrapper);
      this._listeners.delete(cb);
    }
  }

  /**
   * Publish a message on this channel.
   * Sends to current tab if tabId is provided, otherwise via runtime.
   * @param {any} data
   * @param {number} [tabId]
   */
  async publish(data, tabId) {
    const payload = { action: this.name };
    if (data !== undefined) {
      payload.data = data;
    }
    if (typeof tabId === 'number') {
      await chrome.tabs.sendMessage(tabId, payload);
    } else {
      await chrome.runtime.sendMessage(payload);
    }
  }
}
