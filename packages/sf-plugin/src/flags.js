import { Flags } from '@salesforce/sf-plugins-core';
import { SOURCE_NAMES } from './core/index.js';

export const catalogFlags = {
  'target-org': Flags.requiredOrg({
    char: 'o',
    summary:
      'Username or alias of the target org. Defaults to the configured target-org.',
  }),
  source: Flags.string({
    char: 's',
    summary:
      'Command source to include. Repeat the flag to include more sources.',
    options: SOURCE_NAMES,
    multiple: true,
  }),
  'exclude-source': Flags.string({
    summary:
      'Command source to exclude. Repeat to exclude more sources. Exclusions override --source.',
    options: SOURCE_NAMES,
    multiple: true,
  }),
  refresh: Flags.boolean({
    summary: 'Refresh command data instead of using the local cache.',
    default: false,
  }),
};

/**
 * Select sources from the full catalog, then apply exclusions.
 * @param {{source?: string[], "exclude-source"?: string[]}} flags Parsed CLI flags.
 * @returns {string[]}
 */
export function selectedSources(flags) {
  const included = flags.source?.length ? flags.source : SOURCE_NAMES;
  const excluded = new Set(flags['exclude-source'] ?? []);
  return [...new Set(included)].filter((source) => !excluded.has(source));
}
