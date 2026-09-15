import ansis from 'ansis';
import stringWidth from 'string-width';
import { highlightMatches } from './highlight.js';

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

function singleLine(value) {
  return Array.from(String(value ?? ''), (character) => {
    const code = character.codePointAt(0);
    return code < 32 || (code >= 127 && code <= 159) ? ' ' : character;
  }).join('');
}

function cell(value, width, { ranges, right = false, emphasize } = {}) {
  const text = singleLine(value);
  let visible = text;
  let suffix = '';
  if (stringWidth(text) > width) {
    visible = '';
    suffix = '…';
    let used = 0;
    for (const { segment } of graphemes.segment(text)) {
      const size = stringWidth(segment);
      if (used + size > width - 1) break;
      visible += segment;
      used += size;
    }
  }
  const padding = ' '.repeat(
    Math.max(0, width - stringWidth(visible + suffix))
  );
  const styled = highlightMatches(visible, ranges, emphasize) + suffix;
  return right ? padding + styled : styled + padding;
}

function usage(command) {
  return Number.isSafeInteger(command.usage) && command.usage >= 0
    ? String(command.usage)
    : '0';
}

/**
 * Build stable terminal columns for the catalog. Width includes the two-column
 * selection pointer. Very narrow terminals omit Source, then Uses, to keep the
 * command readable. Labels are truncated by grapheme before fuzzy styling.
 * @param {object[]} commands Full catalog, including usage counts.
 * @param {number} [columns] Terminal width.
 * @param {(text: string) => string} [emphasize] Match style override.
 * @returns {{header: string, row: (command: object) => string}}
 */
export function createPaletteTable(commands, columns = 80, emphasize) {
  const available = Math.max(1, Math.floor(columns || 80) - 2);
  const usageWidth = commands.reduce(
    (width, command) => Math.max(width, usage(command).length),
    4
  );
  const showUsage = available >= usageWidth + 10;
  const showSource = available >= usageWidth + 22;
  const sourceWidth = showSource
    ? Math.min(
        commands.reduce(
          (width, command) =>
            Math.max(width, stringWidth(singleLine(command.source))),
          6
        ),
        Math.floor(available / 3)
      )
    : 0;
  const labelWidth =
    available -
    (showUsage ? usageWidth + 2 : 0) -
    (showSource ? sourceWidth + 2 : 0);
  const render = (label, source, count, ranges) => {
    const cells = [cell(label, labelWidth, { ranges, emphasize })];
    if (showSource) cells.push(ansis.dim(cell(source, sourceWidth)));
    if (showUsage)
      cells.push(ansis.dim(cell(count, usageWidth, { right: true })));
    return cells.join('  ');
  };
  return {
    header: `  ${ansis.dim(render('Command', 'Source', 'Uses'))}`,
    row: (command) =>
      render(
        command.label,
        command.source || '-',
        usage(command),
        command.matchRanges
      ),
  };
}
