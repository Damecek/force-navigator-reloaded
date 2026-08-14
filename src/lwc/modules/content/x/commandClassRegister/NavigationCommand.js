import Command from './Command';
import { dispatchLightningNavigation } from '../../../../../content_scripts/lightningNavigationBridge';
import { buildLightningAppNavigationPath } from './lightningAppNavigationPath';
import { buildNavigationCommandUrl } from './navigationCommandUrl';

/**
 * Command that navigates the page to a specified path.
 */
export default class NavigationCommand extends Command {
  /**
   * @param {string} id - Unique identifier for the command.
   * @param {string} label - Display text for the command.
   * @param {string} path - URL path segment (appended to origin).
   * @param {string} [appTarget] - Lightning app target used to preserve current page.
   * @param {'core' | 'lightning'} [host='lightning'] - Salesforce host type.
   */
  constructor({ id, label, path, usage, appTarget, host = 'lightning' } = {}) {
    super(id, label, usage);
    this.path = path;
    this.appTarget = appTarget;
    this.host = host;
  }

  /**
   * Navigate to the command's path.
   * @param {object} [options]
   * @param {boolean} [options.openInNewTab] - If true, opens in a new tab.
   * @returns {Promise<boolean>} whether the palette should close
   */
  async execute({ openInNewTab = false } = {}) {
    await this.incrementUsage();
    const path = this.appTarget
      ? buildLightningAppNavigationPath(this.appTarget, window.location)
      : this.path;
    const url = buildNavigationCommandUrl({
      hostname: this.hostname,
      path,
      host: this.host,
    });
    if (openInNewTab) {
      window.open(url, '_blank');
    } else {
      const isLightningPath =
        path.startsWith('/lightning/o/') || path.startsWith('/lightning/page/');
      const isLightningLocation =
        window.location.pathname.startsWith('/lightning/o/') ||
        window.location.pathname.startsWith('/lightning/page/');

      if (isLightningPath && isLightningLocation) {
        const handled = dispatchLightningNavigation(url);
        if (!handled) {
          window.location.href = url;
        }
      } else {
        window.location.href = url;
      }
    }
    return true;
  }
}
