import Command from './Command';
import { Channel, CHANNEL_OPEN_OPTIONS } from '../../../../shared';

/**
 * Command that navigates the page to a specified path.
 */
export default class ExtensionOptionsCommand extends Command {
  constructor() {
    super('extension-options', 'Extension > Options', 1);
  }

  /**
   * Navigate to the command's path.
   * @param {object} [options]
   * @param {boolean} [options.openInNewTab] - If true, opens in a new tab.
   * @returns {Promise<boolean>} whether the palette should close
   */
  async execute({ openInNewTab = false } = {}) {
    new Channel(CHANNEL_OPEN_OPTIONS).publish();
    return true;
  }
}
