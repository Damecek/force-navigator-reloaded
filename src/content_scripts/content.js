import { mountApp } from './mount';
import { handleMessage } from './messageListener';

/**
 * Entry point for content script: mounts the LWC application and registers message listener.
 * @returns {void}
 */
mountApp();
chrome.runtime.onMessage.addListener(handleMessage);
