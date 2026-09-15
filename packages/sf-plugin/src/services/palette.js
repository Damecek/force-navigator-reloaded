import { join } from 'node:path';
import { buildDestinationUrl } from './destination.js';
import { CommandHistory } from './history.js';
import { openNavigation } from './navigation.js';
import { selectCommand } from './selection.js';

/**
 * Confirm a palette selection, open it, and remember successful catalog commands.
 * @param {object} options Palette context.
 * @param {object} options.context Loaded org and catalog.
 * @param {string} options.query Editable initial text.
 * @param {string} [options.browser] Browser preference.
 * @param {string} options.dataDirectory Plugin data directory.
 * @param {(message: string) => void} options.log Status output.
 * @param {(message: string) => void} options.warn Recoverable history warnings.
 * @param {object} [services] Prompt, navigation, and history adapters.
 * @returns {Promise<void>}
 */
export async function runPalette(
  { context, query, browser, dataDirectory, log, warn },
  {
    select = selectCommand,
    open = openNavigation,
    history = new CommandHistory({
      directory: join(dataDirectory, 'navigator', 'history'),
      orgId: context.orgId,
      username: context.username,
    }),
  } = {}
) {
  let counts = {};
  try {
    counts = await history.read();
  } catch {
    warn('Could not read command history. Using alphabetical order.');
  }
  const commands = context.catalog.commands.map((command) => ({
    ...command,
    usage: Object.hasOwn(counts, command.id) ? counts[command.id] : 0,
  }));
  const selected = await select({
    commands,
    initialTerm: query,
    message: `Open in ${context.username}`,
  });
  if (!selected) {
    log('Selection cancelled.');
    return;
  }
  const command = {
    ...selected,
    url: buildDestinationUrl(context.instanceUrl, selected),
  };
  await open({ org: context.org, command, browser });
  log(`Opened ${command.label} in ${context.username}.`);
  try {
    await history.record(command.id);
  } catch {
    warn('The page opened, but command history could not be saved.');
  }
}
