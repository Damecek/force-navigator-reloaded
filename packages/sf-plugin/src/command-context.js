import { join } from 'node:path';
import { SALESFORCE_API_VERSION } from './core/index.js';
import { getCatalog } from './services/catalog.js';
import { selectedSources } from './flags.js';

/**
 * Load org identity, instance URL, and command catalog for a CLI command.
 * @param {import('@salesforce/sf-plugins-core').SfCommand} command Running command.
 * @param {object} flags Parsed flags.
 * @returns {Promise<object>}
 */
export async function createCommandContext(command, flags) {
  const org = flags['target-org'];
  const connection = org.getConnection(SALESFORCE_API_VERSION);
  const instanceUrl = connection.instanceUrl;
  const sources = selectedSources(flags);
  const catalog = await getCatalog({
    org,
    sources,
    refresh: flags.refresh,
    cacheDirectory: join(command.config.cacheDir, 'navigator', 'catalog'),
    apiVersion: SALESFORCE_API_VERSION,
  });
  return {
    org,
    orgId: org.getOrgId(),
    username: org.getUsername(),
    instanceUrl,
    sources,
    catalog,
  };
}

/**
 * Report source failures while preserving successful command families.
 * @param {import('@salesforce/sf-plugins-core').SfCommand} command Running command.
 * @param {Array<{source: string, message: string}>} errors Source failures.
 */
export function reportCatalogErrors(command, errors) {
  errors.forEach(({ source, message }) => {
    command.warn(`Could not load ${source}: ${message}`);
  });
}
