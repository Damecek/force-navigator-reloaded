import { toCoreUrl, toLightningUrl } from '../../../../../shared/index.js';

/**
 * Resolve a navigation command path against its requested Salesforce host.
 * @param {object} options
 * @param {string} options.hostname Salesforce hostname
 * @param {string} options.path Navigation path
 * @param {'core' | 'lightning'} [options.host='lightning'] Host type
 * @returns {string}
 */
export function buildNavigationCommandUrl({
  hostname,
  path,
  host = 'lightning',
}) {
  const baseUrl =
    host === 'core' ? toCoreUrl(hostname) : toLightningUrl(hostname);
  return `${baseUrl}${path}`;
}
