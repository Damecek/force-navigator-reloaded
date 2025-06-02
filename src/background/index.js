import { handleCommand } from './listeners/commandListener.js';
import { handleMessage } from './listeners/messageListener.js';

/**
 * Background script entry point: commands, and message listeners.
 * @returns {void}
 */

chrome.commands.onCommand.addListener(handleCommand);
chrome.runtime.onMessage.addListener(handleMessage);
