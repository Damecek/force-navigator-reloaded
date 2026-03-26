import uFuzzy from '@leeoniya/ufuzzy';

/**
 * Normalize search values so fuzzy matching ignores Latin diacritics.
 * @param {string} value
 * @returns {string}
 */
export function normalizeSearchValue(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return uFuzzy
    .latinize(value)
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase();
}

/**
 * Filter command descriptors using accent-insensitive fuzzy matching.
 * @param {object} options
 * @param {uFuzzy} options.uf
 * @param {Array<{ label: string }>} options.commands
 * @param {Array<{ label: string }>} options.previousResults
 * @param {string} options.searchTerm
 * @param {string} options.previousSearchTerm
 * @returns {Array<{ label: string }>}
 */
export function filterCommandsBySearchTerm({
  uf,
  commands,
  previousResults,
  searchTerm,
  previousSearchTerm,
}) {
  if (!searchTerm) {
    return [...commands];
  }

  const normalizedSearchTerm = normalizeSearchValue(searchTerm);
  const normalizedPreviousSearchTerm = normalizeSearchValue(previousSearchTerm);
  const currentHaystackSource =
    normalizedPreviousSearchTerm &&
    normalizedSearchTerm.startsWith(normalizedPreviousSearchTerm)
      ? previousResults
      : commands;
  const currentSearchHaystack = currentHaystackSource.map((command) =>
    normalizeSearchValue(command.label)
  );
  const [idxs, info, order] = uf.search(
    currentSearchHaystack,
    normalizedSearchTerm,
    2
  );

  if (order && info && Array.isArray(info.idx)) {
    return order.map((pos) => currentHaystackSource[info.idx[pos]]);
  }

  if (Array.isArray(idxs)) {
    return idxs.map((index) => currentHaystackSource[index]);
  }

  return [];
}
