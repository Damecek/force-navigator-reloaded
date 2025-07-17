import Command from './Command';
import { toLightningUrl } from '../../../../shared';

/**
 * Command that navigates the page to a specified path.
 */
export default class NavigationCommand extends Command {
  /**
   * @param {string} id - Unique identifier for the command.
   * @param {string} label - Display text for the command.
   * @param {string} path - URL path segment (appended to origin).
   */
  constructor({ id, label, path }) {
    super(id, label);
    this.path = path;
  }

  /**
   * Navigate to the command's path.
   * @param {object} [options]
   * @param {boolean} [options.openInNewTab] - If true, opens in a new tab.
   * @returns {Promise<boolean>} whether the palette should close
   */
  async execute({ openInNewTab = false } = {}) {
    await this.incrementUsage();
    const url = `${toLightningUrl(this.hostname)}${this.path}`;
    if (openInNewTab) {
      window.open(url, '_blank');
    } else {
      window.location.href = url;
    }
    return true;
  }
}
