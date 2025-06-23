import Command from './Command';
import {
  CacheManager,
  Channel,
  CHANNEL_REFRESH_COMMANDS,
  COMMAND_CACHE_KEYS,
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
   * @returns {Promise<boolean>} whether the palette should close
   */
  async execute(options) {
    console.log('RefreshCommandListCommand.execute');
    const cache = new CacheManager(toLightningHostname(this.hostname));
    await COMMAND_CACHE_KEYS.forEach((key) => cache.clear(key));
    await new Channel(CHANNEL_REFRESH_COMMANDS).publish();
    return false;
  }
}
