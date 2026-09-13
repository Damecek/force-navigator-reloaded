import ansis from 'ansis';

/**
 * Render a label with fuzzy-match ranges emphasized, like the extension palette.
 * Ranges use exclusive `end` offsets into the source label. Overlapping or
 * malformed ranges are skipped. Styling is a no-op when colors are unsupported.
 * @param {string} label Command label.
 * @param {Array<{start: number, end: number}>} [matchRanges] Match ranges.
 * @param {(text: string) => string} [emphasize] Style applied to matches.
 * @returns {string}
 */
export function highlightMatches(
  label,
  matchRanges = [],
  emphasize = ansis.bold.underline
) {
  if (typeof label !== 'string') {
    return '';
  }
  let cursor = 0;
  let rendered = '';
  for (const range of Array.isArray(matchRanges) ? matchRanges : []) {
    const start = Math.max(cursor, Number(range?.start));
    const end = Math.min(label.length, Number(range?.end));
    if (!Number.isInteger(start) || !Number.isInteger(end) || start >= end) {
      continue;
    }
    rendered += label.slice(cursor, start) + emphasize(label.slice(start, end));
    cursor = end;
  }
  return rendered + label.slice(cursor);
}

/**
 * Render a command line for terminal output: highlighted label and dim source.
 * @param {{label: string, source: string, matchRanges?: object[]}} command Command.
 * @returns {string}
 */
export function formatCommandLine(command) {
  return `${highlightMatches(command.label, command.matchRanges)} ${ansis.dim(
    `[${command.source}]`
  )}`;
}
