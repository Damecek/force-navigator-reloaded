/**
 * Check whether a tab messaging rejection only means the receiver is not ready.
 * @param {unknown} error
 * @returns {boolean}
 */
function isMissingTabReceiverError(error) {
  return (
    error instanceof Error &&
    (error.message.includes('Receiving end does not exist') ||
      /No tab with id/i.test(error.message))
  );
}

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
   * With `respond` enabled the resolved callback value is sent back to the
   * publisher, which receives it from {@link Channel#request}.
   * @param {({data: any, sender: chrome.runtime.MessageSender}) => any} cb
   * @param {{respond?: boolean}} [options]
   */
  subscribe(cb, { respond = false } = {}) {
    console.log('Subscribing to channel', this.name);
    const wrapper = (msg, sender, sendResponse) => {
      if (msg.action !== this.name) {
        return false;
      }
      console.log('Handling message', msg.action, 'in channel', this.name);
      const result = cb({ data: msg.data, sender });
      if (!respond) {
        return result;
      }
      Promise.resolve(result)
        .catch((error) => {
          console.error(`Channel "${this.name}" responder failed`, error);
          return null;
        })
        .then((value) => sendResponse(value ?? null));
      return true;
    };
    this._listeners.set(cb, wrapper);
    chrome.runtime.onMessage.addListener(wrapper);
  }

  /**
   * Unsubscribe previously registered callback.
   * @param {({data: any, sender: chrome.runtime.MessageSender}) => any} cb
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
   * Send a message to the background and wait for the subscriber's response.
   * @param {any} [data]
   * @returns {Promise<any>} Response value, or null when nobody responded.
   */
  async request(data) {
    console.log('Requesting on channel', this.name);
    try {
      const response = await chrome.runtime.sendMessage({
        action: this.name,
        data,
      });
      return response ?? null;
    } catch (error) {
      console.log(`Channel "${this.name}": request failed`, error?.message);
      return null;
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
    if (typeof tabId !== 'number') {
      return chrome.runtime.sendMessage(payload);
    }

    return chrome.tabs.sendMessage(tabId, payload).catch((error) => {
      if (isMissingTabReceiverError(error)) {
        console.log(
          `Channel "${this.name}": target tab receiver is not available yet`
        );
        return undefined;
      }
      throw error;
    });
  }
}
