import { buildLightningComponentPath } from './componentUrl.js';

/**
 * Sort most-used commands first, then by label, matching the extension palette.
 * @param {{label: string, usage?: number}} a
 * @param {{label: string, usage?: number}} b
 * @returns {number}
 */
export function compareCommandUsage(a, b) {
  const diff = (b.usage || 0) - (a.usage || 0);
  if (diff !== 0) {
    return diff;
  }
  return a.label < b.label ? -1 : a.label > b.label ? 1 : 0;
}

/**
 * Extract a global record search term, or null for ordinary command filtering.
 * @param {string} value
 * @returns {string|null}
 */
export function getSearchModeTerm(value) {
  const normalizedValue = typeof value === 'string' ? value.trimStart() : '';
  return normalizedValue.startsWith('?')
    ? normalizedValue.slice(1).trim()
    : null;
}

/**
 * Build the transient global record search destination shown in the palette.
 * Empty terms retain the Search label; callers must wait for a nonempty term.
 * @param {string} term
 * @returns {{id: string, label: string, usage: number, host: string, path: string}}
 */
export function buildSearchRecordsCommand(term) {
  const normalizedTerm = typeof term === 'string' ? term.trim() : '';
  return {
    id: 'search-records',
    label: normalizedTerm ? `Search > ${normalizedTerm}` : 'Search',
    usage: 0,
    host: 'lightning',
    path: buildLightningComponentPath({
      componentDef: 'forceSearch:searchPageDesktop',
      attributes: { term: normalizedTerm },
    }),
  };
}
