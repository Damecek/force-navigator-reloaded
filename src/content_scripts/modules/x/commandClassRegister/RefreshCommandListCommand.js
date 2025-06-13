import Command from './Command';
import {
  CacheManager,
  CHANNEL_GET_COMMANDS,
  ENTITY_CACHE_KEY,
  MENU_CACHE_KEY,
  toLightningHostname,
} from '../../../../shared';

/**
 * Command to refresh the list of dynamic commands in the command palette.
 * Clears cached setup nodes and triggers a reload in the content script.
 */
export default class RefreshCommandListCommand extends Command {
  /**
   * Initializes the refresh command with default id and label.
   */
  constructor() {
    super('RefreshCommandListCommand', 'Refresh Command List');
  }

  /**
   * Executes the command: clears cache and dispatches refresh event.
   * @param {object} [options] Execution options (unused).
   * @returns {Promise<void>}
   */
  async execute(options) {
    console.log('RefreshCommandListCommand.execute');
    const cache = new CacheManager(toLightningHostname(this.hostname));
    await cache.clear(MENU_CACHE_KEY);
    await cache.clear(ENTITY_CACHE_KEY);
    await chrome.runtime.sendMessage({
      action: CHANNEL_GET_COMMANDS,
    });
  }
}
