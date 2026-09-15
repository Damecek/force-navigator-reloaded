import Command from './Command';
import { toLightningUrl } from '../../../../../shared';
import { buildSearchRecordsCommand } from '../../../../../navigator/palette.js';

/**
 * Command that opens Salesforce global search for the provided term.
 */
export default class SearchRecordsCommand extends Command {
  /**
   * @param {object} [options]
   * @param {string} [options.term]
   */
  constructor({ term } = {}) {
    const normalizedTerm = typeof term === 'string' ? term.trim() : '';
    const descriptor = buildSearchRecordsCommand(normalizedTerm);
    super(descriptor.id, descriptor.label, descriptor.usage);
    this.term = normalizedTerm;
  }

  /**
   * Open Salesforce global search for the command term.
   * @param {object} [options]
   * @param {boolean} [options.openInNewTab]
   * @returns {Promise<boolean>}
   */
  async execute({ openInNewTab = false } = {}) {
    if (!this.term) {
      return false;
    }
    await this.incrementUsage();

    const url = `${toLightningUrl(this.hostname)}${buildSearchRecordsCommand(this.term).path}`;

    if (openInNewTab) {
      window.open(url, '_blank');
    } else {
      window.location.href = url;
    }

    return true;
  }
}
