import Command from './Command';
import { buildLightningComponentUrl } from '../../../../../shared';

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
    const labelSuffix = normalizedTerm ? ` > ${normalizedTerm}` : '';
    super('search-records', `Search${labelSuffix}`, 0);
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

    const url = buildLightningComponentUrl(this.hostname, {
      componentDef: 'forceSearch:searchPageDesktop',
      attributes: {
        term: this.term,
      },
    });

    if (openInNewTab) {
      window.open(url, '_blank');
    } else {
      window.location.href = url;
    }

    return true;
  }
}
