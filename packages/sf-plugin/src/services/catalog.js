import {
  createSearchEngine,
  filterCommandsBySearchTerm,
  loadCatalog,
} from '../core/index.js';
import { CatalogCache } from './cache.js';
import { createNavigatorConnection } from './connection.js';

/**
 * Load a cached or fresh command catalog for an org.
 * @param {object} options Options.
 * @param {import('@salesforce/core').Org} options.org Authenticated org.
 * @param {string[]} options.sources Selected sources.
 * @param {boolean} options.refresh Bypass cache.
 * @param {string} options.cacheDirectory Cache directory.
 * @param {string} options.apiVersion Pinned API version.
 * @param {CatalogCache} [options.cache] Cache override for tests.
 * @returns {Promise<{commands: object[], errors: object[], cached: boolean, generatedAt: string}>}
 */
export async function getCatalog({
  org,
  sources,
  refresh,
  cacheDirectory,
  apiVersion,
  cache = new CatalogCache({ directory: cacheDirectory }),
}) {
  const scope = {
    orgId: org.getOrgId(),
    username: org.getUsername(),
    sources,
    apiVersion,
  };
  if (!refresh) {
    const cachedCatalog = await cache.read(scope);
    if (cachedCatalog) {
      return {
        commands: cachedCatalog.commands,
        errors: cachedCatalog.errors,
        cached: true,
        generatedAt: new Date(cachedCatalog.createdAt).toISOString(),
      };
    }
  }

  const catalog = await loadCatalog({
    connection: createNavigatorConnection(org, apiVersion),
    sources,
  });
  const createdAt = Date.now();
  if (catalog.errors.length === 0) {
    await cache.write(scope, catalog);
  }
  return {
    ...catalog,
    cached: false,
    generatedAt: new Date(createdAt).toISOString(),
  };
}

/**
 * Apply the extension's fuzzy search order to a catalog.
 * @param {object[]} commands Commands to search.
 * @param {string} query Search text.
 * @returns {object[]}
 */
export function searchCatalog(commands, query) {
  return filterCommandsBySearchTerm({
    uf: createSearchEngine(),
    commands,
    previousResults: commands,
    searchTerm: query,
    previousSearchTerm: '',
  }).map(({ matchRanges, ...command }) => command);
}

/**
 * Resolve one command by exact ID or fuzzy query.
 * @param {{commands: object[], id?: string, query?: string}} options Selection.
 * @returns {object[]}
 */
export function resolveCommands({ commands, id, query = '' }) {
  if (id) {
    return commands.filter((command) => command.id === id);
  }
  return searchCatalog(commands, query);
}

/**
 * Check whether every requested source failed to load.
 * @param {{errors: Array<{source: string}>, sources: string[]}} options Result and request.
 * @returns {boolean}
 */
export function didAllSourcesFail({ errors, sources }) {
  const failedSources = new Set(errors.map(({ source }) => source));
  return (
    sources.length > 0 && sources.every((source) => failedSources.has(source))
  );
}
