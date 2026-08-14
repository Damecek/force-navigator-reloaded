import uFuzzy from '@leeoniya/ufuzzy';

/**
 * Normalize search values so fuzzy matching ignores Latin diacritics.
 * @param {string} value
 * @returns {string}
 */
export function normalizeSearchValue(value) {
  return normalizeSearchValueWithMap(value).normalized;
}

/**
 * Normalize a search value and preserve the source range of every normalized
 * character for converting uFuzzy match ranges back to the display label.
 * @param {string} value
 * @returns {{ normalized: string, sourceRanges: Array<{start: number, end: number}> }}
 */
export function normalizeSearchValueWithMap(value) {
  if (typeof value !== 'string') {
    return { normalized: '', sourceRanges: [] };
  }

  let normalized = '';
  const sourceRanges = [];
  let sourceIndex = 0;

  while (sourceIndex < value.length) {
    const sourceStart = sourceIndex;
    let sourcePart = value.codePointAt(sourceIndex);
    const sourceCharacter = String.fromCodePoint(sourcePart);
    sourceIndex += sourceCharacter.length;

    while (sourceIndex < value.length) {
      sourcePart = value.codePointAt(sourceIndex);
      const nextCharacter = String.fromCodePoint(sourcePart);
      if (!/^\p{M}$/u.test(nextCharacter)) {
        break;
      }
      sourceIndex += nextCharacter.length;
    }

    const normalizedPart = uFuzzy
      .latinize(value.slice(sourceStart, sourceIndex))
      .normalize('NFD')
      .replace(/\p{M}+/gu, '')
      .toLowerCase();

    for (const character of normalizedPart) {
      normalized += character;
      for (let offset = 0; offset < character.length; offset += 1) {
        sourceRanges.push({ start: sourceStart, end: sourceIndex });
      }
    }
  }

  return { normalized, sourceRanges };
}

/**
 * Convert uFuzzy's normalized-label ranges to source-label ranges.
 * @param {number[]} normalizedRanges
 * @param {Array<{start: number, end: number}>} sourceRanges
 * @returns {Array<{start: number, end: number}>}
 */
function translateMatchRanges(normalizedRanges, sourceRanges) {
  if (!Array.isArray(normalizedRanges)) {
    return [];
  }

  const matchRanges = [];
  for (let index = 0; index < normalizedRanges.length; index += 2) {
    const start = sourceRanges[normalizedRanges[index]];
    const end = sourceRanges[normalizedRanges[index + 1] - 1];
    if (start && end) {
      matchRanges.push({ start: start.start, end: end.end });
    }
  }
  return matchRanges;
}

/**
 * Copy a command descriptor with transient match ranges for rendering.
 * @param {{ label: string }} command
 * @param {number[]} normalizedRanges
 * @returns {{ label: string, matchRanges: Array<{start: number, end: number}> }}
 */
function withMatchRanges(command, normalizedRanges = []) {
  const { sourceRanges } = normalizeSearchValueWithMap(command.label);
  return {
    ...command,
    matchRanges: translateMatchRanges(normalizedRanges, sourceRanges),
  };
}

/**
 * Filter command descriptors using accent-insensitive fuzzy matching.
 * @param {object} options
 * @param {uFuzzy} options.uf
 * @param {Array<{ label: string }>} options.commands
 * @param {Array<{ label: string }>} options.previousResults
 * @param {string} options.searchTerm
 * @param {string} options.previousSearchTerm
 * @returns {Array<{ label: string, matchRanges: Array<{start: number, end: number}> }>}
 */
export function filterCommandsBySearchTerm({
  uf,
  commands,
  previousResults,
  searchTerm,
  previousSearchTerm,
}) {
  if (!searchTerm) {
    return commands.map((command) => withMatchRanges(command));
  }

  const normalizedSearchTerm = normalizeSearchValue(searchTerm);
  const normalizedPreviousSearchTerm = normalizeSearchValue(previousSearchTerm);
  const currentHaystackSource =
    normalizedPreviousSearchTerm &&
    normalizedSearchTerm.startsWith(normalizedPreviousSearchTerm)
      ? previousResults
      : commands;
  const normalizedHaystack = currentHaystackSource.map((command) =>
    normalizeSearchValueWithMap(command.label)
  );
  const currentSearchHaystack = normalizedHaystack.map(
    ({ normalized }) => normalized
  );
  const [idxs, info, order] = uf.search(
    currentSearchHaystack,
    normalizedSearchTerm,
    2
  );

  if (order && info && Array.isArray(info.idx)) {
    return order.map((pos) => {
      const sourceIndex = info.idx[pos];
      return withMatchRanges(
        currentHaystackSource[sourceIndex],
        info.ranges && info.ranges[pos]
      );
    });
  }

  if (Array.isArray(idxs)) {
    return idxs.map((index) => withMatchRanges(currentHaystackSource[index]));
  }

  return [];
}
