import Command from './Command';
import {
  CacheManager,
  Channel,
  CHANNEL_REFRESH_COMMANDS,
  COMMAND_CACHE_KEYS,
  toLightningHostname,
} from '../../../../../shared';
import { publishCommandLoading } from '../loading/loadingEvents';

/**
 * Command to refresh the list of dynamic commands in the command palette.
 * Clears cached setup nodes and triggers a reload in the content script.
 */
export default class RefreshCommandListCommand extends Command {
  /**
   * Initializes the refresh command with default id and label.
   */
  constructor({ usage } = {}) {
    super(
      'RefreshCommandListCommand',
      'Extension > Refresh Command List',
      usage ?? 1
    );
  }

  /**
   * Executes the command: clears cache and dispatches refresh event.
   * @param {object} [options] Execution options (unused).
   * @returns {Promise<boolean>} whether the palette should close
   */
  async execute(options) {
    console.log('RefreshCommandListCommand.execute');
    publishCommandLoading(true);
    const cache = new CacheManager(toLightningHostname(this.hostname));
    await Promise.all(COMMAND_CACHE_KEYS.map((key) => cache.clear(key)));
    await new Channel(CHANNEL_REFRESH_COMMANDS).publish();
    return false;
  }
}
