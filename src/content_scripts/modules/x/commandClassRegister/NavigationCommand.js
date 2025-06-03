import Command from './Command';

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
   * @returns {Promise<void>}
   */
  execute({ openInNewTab = false } = {}) {
    const url = `${window.location.origin}${this.path}`;
    if (openInNewTab) {
      window.open(url, '_blank');
    } else {
      window.location.href = url;
    }
    return Promise.resolve();
  }
}
