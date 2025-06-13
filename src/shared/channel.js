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
   // * @param {(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => void} cb
   */
  subscribe(cb) {
    console.log('Subscribing to channel', this.name);
    const wrapper = (msg, sender, sendResponse) => {
      if (msg.action !== this.name) {
        return false;
      }
      console.log('Handling message', msg.action, 'in channel', this.name);
      return cb({ data: msg.data, sender, sendResponse });
    };
    this._listeners.set(cb, wrapper);
    chrome.runtime.onMessage.addListener(wrapper);
  }

  /**
   * Unsubscribe previously registered callback.
   * @param {(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => void} cb
   */
  unsubscribe(cb) {
    console.log('Unsubscribing from channel', this.name);
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
  publish({ data, tabId } = {}) {
    console.log('Publishing to channel', this.name);
    const payload = { action: this.name, data };
    return typeof tabId === 'number'
      ? chrome.tabs.sendMessage(tabId, payload)
      : chrome.runtime.sendMessage(payload);
  }
}
