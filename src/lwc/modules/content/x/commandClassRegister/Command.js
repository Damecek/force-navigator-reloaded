/**
 * Abstract base class for commands in the command palette.
 */
import { UsageTracker } from '../../../../../shared';

export default class Command {
  /**
   * @param {string} id - Unique identifier for the command.
   * @param {string} label - Display text for the command.
   * @param {number} [defaultUsage=0] - Initial usage count (default is 0).
   */
  constructor(id, label, defaultUsage) {
    this.id = id;
    this.label = label;
    this.hostname = window.location.hostname;
    if (defaultUsage !== undefined) {
      this.usage = defaultUsage;
    } else {
      UsageTracker.instance()
        .then((i) => i.getUsage(this.id))
        .then((u) => {
          this.usage = u;
        });
    }
  }

  async incrementUsage() {
    return (await UsageTracker.instance()).incrementUsage(this.id);
  }

  /**
   * Execute the command's action.
   *
   * @param {object} [options] - Optional parameters for execution (e.g., openInNewTab).
   * @returns {Promise<boolean>} whether the palette should close after executing
   */
  execute(options) {
    return Promise.reject(
      new Error('execute() must be implemented by subclass')
    );
  }
}
