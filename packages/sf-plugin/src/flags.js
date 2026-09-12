import { Flags } from '@salesforce/sf-plugins-core';
import { SOURCE_NAMES } from './core/index.js';

export const catalogFlags = {
  'target-org': Flags.requiredOrg({
    char: 'o',
    summary: 'Username or alias of the target org.',
  }),
  source: Flags.string({
    char: 's',
    summary:
      'Command source to include. Repeat the flag to include more sources.',
    options: SOURCE_NAMES,
    multiple: true,
  }),
  refresh: Flags.boolean({
    summary: 'Refresh command data instead of using the local cache.',
    default: false,
  }),
};

/**
 * Expand source flags to the complete catalog when no filters were supplied.
 * @param {{source?: string[]}} flags Parsed CLI flags.
 * @returns {string[]}
 */
export function selectedSources(flags) {
  return flags.source?.length ? [...new Set(flags.source)] : [...SOURCE_NAMES];
}
