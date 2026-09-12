export { toLightningUrl, toCoreUrl, toSetupUrl } from './urls.js';
import * as queries from './queries.js';
import * as builders from './builders.js';
import {
  buildApexClassCommands,
  buildApexTriggerCommands,
} from './apexCommands.js';
import { buildExperienceSiteCommands } from './experienceSiteCommands.js';
import { staticCommands } from './staticCommands.js';
export {
  createSearchEngine,
  filterCommandsBySearchTerm,
  normalizeSearchValue,
} from './searchMatching.js';
export { SALESFORCE_API_VERSION } from './constants.js';

const SOURCE_LOADERS = {
  static: async () => staticCommands,
  setup: async (connection) =>
    builders.buildSetupCommands(
      await queries.fetchMenuNodesFromSalesforce(connection)
    ),
  objects: async (connection) =>
    builders.buildEntityCommands(
      await queries.fetchEntityDefinitionsFromSalesforce(connection)
    ),
  flows: async (connection) =>
    builders.buildFlowCommands(
      await queries.fetchFlowDefinitionsFromSalesforce(connection)
    ),
  'apex-classes': async (connection) =>
    buildApexClassCommands(
      await queries.fetchApexClassesFromSalesforce(connection)
    ),
  'apex-triggers': async (connection) =>
    buildApexTriggerCommands(
      await queries.fetchApexTriggersFromSalesforce(connection)
    ),
  'experience-sites': async (connection) => {
    const [networks, sites] = await Promise.all([
      queries.fetchNetworksFromSalesforce(connection),
      queries.fetchExperienceSitesFromSalesforce(connection),
    ]);
    return buildExperienceSiteCommands(networks, sites);
  },
  apps: async (connection) =>
    builders.buildLightningAppCommands(
      await queries.fetchLightningAppDefinitionsFromSalesforce(connection)
    ),
  'permission-sets': async (connection) =>
    builders.buildPermissionCommands(
      await queries.fetchPermissionSetsFromSalesforce(connection)
    ),
  'permission-set-groups': async (connection) =>
    builders.buildPermissionCommands(
      [],
      await queries.fetchPermissionSetGroupsFromSalesforce(connection)
    ),
  users: async (connection) =>
    builders.buildUserCommands(
      await queries.fetchUsersFromSalesforce(connection)
    ),
};

/** Available navigational families. Extension-only operations are excluded. */
export const SOURCE_NAMES = Object.freeze(Object.keys(SOURCE_LOADERS));

/**
 * Load navigation descriptors without authentication, cache, or browser state.
 * Both connection methods must return every record, following API query locators.
 * A failed family is reported separately from an empty family.
 * @param {{connection: {query: Function, toolingQuery: Function}, sources?: string[]}} options
 * @returns {Promise<{commands: object[], errors: Array<{source: string, message: string}>}>}
 */
export async function loadCatalog({ connection, sources = SOURCE_NAMES }) {
  if (
    !Array.isArray(sources) ||
    sources.some((source) => !SOURCE_NAMES.includes(source))
  ) {
    throw new TypeError(
      `Sources must be selected from: ${SOURCE_NAMES.join(', ')}`
    );
  }
  if (
    sources.some((source) => source !== 'static') &&
    (!connection ||
      typeof connection.query !== 'function' ||
      typeof connection.toolingQuery !== 'function')
  ) {
    throw new TypeError(
      'A connection with query and toolingQuery methods is required.'
    );
  }
  const results = await Promise.all(
    [...new Set(sources)].map(async (source) => {
      try {
        const commands = await SOURCE_LOADERS[source](connection);
        return {
          commands: commands.map((command) => ({ ...command, source })),
          errors: [],
        };
      } catch (error) {
        return {
          commands: [],
          errors: [
            {
              source,
              message: error instanceof Error ? error.message : String(error),
            },
          ],
        };
      }
    })
  );
  return {
    commands: results.flatMap((result) => result.commands),
    errors: results.flatMap((result) => result.errors),
  };
}
