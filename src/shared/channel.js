/**
 * @typedef {Object} ChannelErrorPayload
 * @property {string} message Human readable error message.
 * @property {string} [name] Optional error name.
 * @property {string} [stack] Original stack trace when available.
 * @property {Record<string, any>} [details] Additional serializable properties from the error.
 */

/**
 * @typedef {Object} ChannelMessage
 * @property {any} data Optional data provided by the publisher.
 * @property {Error|undefined} [error] Normalized error that originated in the publisher.
 * @property {chrome.runtime.MessageSender} sender Message sender metadata provided by Chrome.
 */

/**
 * Simple wrapper around chrome runtime messaging APIs scoped by channel name.
 * Chrome message passing only accepts JSON-serializable payloads
 * {@link https://developer.chrome.com/docs/extensions/mv3/messaging/#serialization},
 * so errors must be flattened before sending and reconstructed on receipt.
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
   * @param {(message: ChannelMessage) => any} cb
   */
  subscribe(cb) {
    console.log('Subscribing to channel', this.name);
    const wrapper = (msg, sender) => {
      if (msg.action !== this.name) {
        return false;
      }
      console.log('Handling message', msg.action, 'in channel', this.name);
      return cb({
        data: msg.data,
        error: deserializeError(msg.error),
        sender,
      });
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
   * Publish a message on this channel.
   * Sends to current tab if tabId is provided, otherwise via runtime.
   * @param {any} data
   * @param {Error|undefined} [error]
   * @param {number} [tabId]
   * Errors are serialized per Chrome messaging JSON-only restriction:
   * {@link https://developer.chrome.com/docs/extensions/mv3/messaging/#serialization}.
   */
  publish({ data, error, tabId } = {}) {
    console.log('Publishing to channel', this.name);
    const payload = { action: this.name };
    if (typeof data !== 'undefined') {
      payload.data = data;
    }
    const normalizedError = normalizeError(error);
    const serializedError = serializeError(normalizedError);
    if (serializedError) {
      payload.error = serializedError;
    }
    return typeof tabId === 'number'
      ? chrome.tabs.sendMessage(tabId, payload)
      : chrome.runtime.sendMessage(payload);
  }
}

/**
 * Convert any thrown value into a structured payload safe for runtime messaging.
 * @param {any} error
 * @returns {ChannelErrorPayload|undefined}
 */
function serializeError(error) {
  if (!error) {
    return undefined;
  }
  const payload = {
    name:
      typeof error.name === 'string' && error.name.trim()
        ? error.name
        : 'Error',
    message:
      typeof error.message === 'string' && error.message.trim()
        ? error.message
        : 'Unexpected channel error',
  };
  if (typeof error.stack === 'string' && error.stack.trim()) {
    payload.stack = error.stack;
  }
  const details = extractSerializableFields(error, [
    'name',
    'message',
    'stack',
  ]);
  if (details) {
    payload.details = details;
  }
  return payload;
}

/**
 * Ensure the provided value is represented as an Error instance.
 * @param {any} error
 * @returns {Error|undefined}
 */
function normalizeError(error) {
  if (!error) {
    return undefined;
  }
  if (error instanceof Error) {
    return error;
  }
  const normalized = new Error(extractMessage(error));
  if (error && typeof error === 'object') {
    Object.keys(error).forEach((key) => {
      normalized[key] = error[key];
    });
  }
  return normalized;
}

/**
 * Determine the best-effort message for a non-Error value.
 * @param {any} source
 * @returns {string}
 */
function extractMessage(source) {
  if (typeof source === 'string' && source.trim()) {
    return source;
  }
  if (source && typeof source === 'object') {
    if (typeof source.message === 'string' && source.message.trim()) {
      return source.message;
    }
    try {
      return JSON.stringify(source);
    } catch {
      return '[object Object]';
    }
  }
  return String(source);
}

/**
 * Pick enumerable, serializable fields from an object.
 * @param {Record<string, any>} source
 * @param {string[]} excludedKeys
 * @returns {Record<string, any>|undefined}
 */
function extractSerializableFields(source, excludedKeys) {
  const details = Object.keys(source).reduce((acc, key) => {
    if (!excludedKeys.includes(key)) {
      acc[key] = source[key];
    }
    return acc;
  }, {});
  return Object.keys(details).length ? details : undefined;
}

/**
 * Rehydrate a serialized error payload back into an Error instance.
 * @param {ChannelErrorPayload|undefined} payload
 * @returns {Error|undefined}
 */
function deserializeError(payload) {
  if (!payload) {
    return undefined;
  }
  const error = new Error(payload.message || 'Unknown channel error');
  if (payload.name) {
    error.name = payload.name;
  }
  if (payload.stack) {
    error.stack = payload.stack;
  }
  if (payload.details && typeof payload.details === 'object') {
    Object.assign(error, payload.details);
  }
  return error;
}
