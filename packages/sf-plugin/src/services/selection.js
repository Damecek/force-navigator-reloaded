import {
  createPrompt,
  isDownKey,
  isEnterKey,
  isUpKey,
  makeTheme,
  useEffect,
  useKeypress,
  useMemo,
  usePagination,
  usePrefix,
  useState,
} from '@inquirer/core';
import ansis from 'ansis';
import { searchCatalog } from './catalog.js';
import { formatCommandLine } from './highlight.js';

export const DEFAULT_PAGE_SIZE = 12;

/**
 * Check whether a keypress should cancel the selection.
 * @param {{name?: string, ctrl?: boolean}} key Keypress.
 * @param {string} line Current input line.
 * @returns {boolean}
 */
export function isCancelKey(key, line) {
  return key.name === 'escape' || (line === '' && key.name === 'q');
}

const commandPrompt = createPrompt((config, done) => {
  const { commands, initialTerm = '', pageSize = DEFAULT_PAGE_SIZE } = config;
  const theme = makeTheme(config.theme);
  const [status, setStatus] = useState('idle');
  const [term, setTerm] = useState(initialTerm);
  const [cursor, setCursor] = useState(0);
  const [cancelled, setCancelled] = useState(false);
  const prefix = usePrefix({ status, theme });
  const results = useMemo(() => searchCatalog(commands, term), [term]);
  const active = Math.min(cursor, Math.max(results.length - 1, 0));
  const selected = results[active];

  useEffect((rl) => {
    if (initialTerm) {
      rl.write(initialTerm);
    }
  }, []);

  useKeypress((key, rl) => {
    if (isCancelKey(key, rl.line)) {
      setCancelled(true);
      setStatus('done');
      done(null);
    } else if (isEnterKey(key)) {
      if (selected) {
        setStatus('done');
        done(selected);
      } else {
        rl.write(term);
      }
    } else if (isUpKey(key) || isDownKey(key)) {
      if (results.length > 0) {
        const offset = isUpKey(key) ? -1 : 1;
        setCursor((active + offset + results.length) % results.length);
      }
    } else if (rl.line !== term) {
      setTerm(rl.line);
      setCursor(0);
    }
  });

  const message = theme.style.message(config.message, status);
  if (status === 'done') {
    return `${prefix} ${message} ${theme.style.answer(
      cancelled || !selected ? 'cancelled' : selected.label
    )}`;
  }

  const page = usePagination({
    items: results,
    active,
    pageSize,
    loop: false,
    renderItem: ({ item, isActive }) => {
      const line = formatCommandLine(item);
      return isActive ? theme.style.highlight(`❯ ${line}`) : `  ${line}`;
    },
  });
  const body =
    results.length === 0
      ? theme.style.error('No matching commands')
      : `${page}\n${ansis.dim(
          `${results.length} match${results.length === 1 ? '' : 'es'}`
        )}`;
  const help = ansis.dim('↑↓ move · Enter open · Esc cancel');
  return [`${prefix} ${message} ${ansis.cyan(term)}`, `${body}\n${help}`];
});

/**
 * Select a command interactively: the term is editable, results re-rank on
 * every keystroke with the extension's fuzzy matching, and Esc cancels.
 * @param {object} options Options.
 * @param {object[]} options.commands Full command catalog.
 * @param {string} [options.initialTerm] Query to prefill.
 * @param {string} [options.message] Prompt label.
 * @param {number} [options.pageSize] Visible rows.
 * @param {{input?: NodeJS.ReadableStream, output?: NodeJS.WritableStream}} [streams] Prompt streams.
 * @returns {Promise<object|null>} Selected command, or null when cancelled.
 */
export async function selectCommand(
  { commands, initialTerm = '', message = 'Open', pageSize },
  streams = {}
) {
  try {
    return await commandPrompt(
      { commands, initialTerm, message, pageSize },
      { ...streams, clearPromptOnDone: false }
    );
  } catch (error) {
    if (error?.name === 'ExitPromptError') {
      return null;
    }
    throw error;
  }
}
