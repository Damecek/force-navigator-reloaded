import { toCoreUrl, toLightningUrl, toSetupUrl } from '../core/index.js';

const HOST_BUILDERS = {
  core: toCoreUrl,
  lightning: toLightningUrl,
  setup: toSetupUrl,
};

/**
 * Build a credential-free Salesforce destination URL.
 * @param {string} instanceUrl Org instance URL.
 * @param {{path: string, host?: 'core'|'lightning'|'setup'}} command Navigation descriptor.
 * @returns {string}
 */
export function buildDestinationUrl(instanceUrl, command) {
  const host = command.host ?? 'lightning';
  const buildOrigin = HOST_BUILDERS[host];
  if (!buildOrigin) {
    throw new Error(`Unsupported command host: ${host}`);
  }
  if (
    typeof command.path !== 'string' ||
    !command.path.startsWith('/') ||
    command.path.startsWith('//') ||
    command.path.includes('\\')
  ) {
    throw new Error(
      `Command ${command.id ?? '<unknown>'} has an invalid path.`
    );
  }
  const origin = buildOrigin(instanceUrl);
  const destination = new URL(command.path, `${origin}/`);
  if (destination.origin !== origin) {
    throw new Error(
      `Command ${command.id ?? '<unknown>'} leaves its Salesforce host.`
    );
  }
  return destination.toString();
}

/**
 * Add stable host and credential-free URL fields to command descriptors.
 * @param {object[]} commands Commands.
 * @param {string} instanceUrl Org instance URL.
 * @returns {object[]}
 */
export function addDestinationUrls(commands, instanceUrl) {
  return commands.map((command) => ({
    ...command,
    host: command.host ?? 'lightning',
    url: buildDestinationUrl(instanceUrl, command),
  }));
}
