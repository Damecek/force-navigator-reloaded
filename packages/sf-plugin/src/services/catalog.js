import {
  createSearchEngine,
  compareCommandUsage,
  buildSearchRecordsCommand,
  getSearchModeTerm,
  filterCommandsBySearchTerm,
  loadCatalog,
} from '../core/index.js';
import { Diagnostics } from './diagnostics.js';
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
 * @param {() => void} [options.onLoadStart] Called on an org-backed cache miss or refresh.
 * @param {(status: string) => void} [options.onLoadEnd] Called before returning or throwing after loading.
 * @param {Diagnostics} [options.diagnostics] Optional cache and query timings.
 * @param {CatalogCache} [options.cache] Cache override for tests.
 * @returns {Promise<{commands: object[], errors: object[], cached: boolean, generatedAt: string}>}
 */
export async function getCatalog({
  org,
  sources,
  refresh,
  cacheDirectory,
  apiVersion,
  diagnostics = new Diagnostics(),
  onLoadStart = () => {},
  onLoadEnd = () => {},
  cache = new CatalogCache({ directory: cacheDirectory }),
}) {
  const scope = {
    orgId: org.getOrgId(),
    username: org.getUsername(),
    sources,
    apiVersion,
  };
  if (!refresh) {
    const cachedCatalog = await diagnostics.measure('Cache read', () =>
      cache.read(scope)
    );
    diagnostics.note(`Cache: ${cachedCatalog ? 'hit' : 'miss'}`);
    if (cachedCatalog) {
      return {
        commands: cachedCatalog.commands,
        errors: cachedCatalog.errors,
        cached: true,
        generatedAt: new Date(cachedCatalog.createdAt).toISOString(),
      };
    }
  } else {
    diagnostics.note('Cache: bypassed (--refresh)');
  }

  const communicatesWithOrg = sources.some((source) => source !== 'static');
  let status = 'Failed';
  if (communicatesWithOrg) onLoadStart();
  try {
    const catalog = await loadCatalog({
      connection: createNavigatorConnection(org, apiVersion, diagnostics),
      sources,
    });
    const createdAt = Date.now();
    if (catalog.errors.length === 0) {
      await diagnostics.measure('Cache write', () =>
        cache.write(scope, catalog)
      );
    }
    if (catalog.errors.length > 0)
      diagnostics.note('Cache write: skipped (source errors)');
    status = didAllSourcesFail({ errors: catalog.errors, sources })
      ? 'Failed'
      : catalog.errors.length
        ? 'Partial'
        : 'Done';
    return {
      ...catalog,
      cached: false,
      generatedAt: new Date(createdAt).toISOString(),
    };
  } finally {
    if (communicatesWithOrg) onLoadEnd(status);
  }
}

/**
 * Filter the palette and order matches by usage, then label, like the extension.
 * A ? prefix selects Salesforce global record search instead of catalog matching.
 * @param {object[]} commands Commands to search.
 * @param {string} query Search text.
 * @returns {object[]}
 */
export function searchCatalog(commands, query) {
  const term = getSearchModeTerm(query);
  if (term !== null) {
    return term ? [buildSearchRecordsCommand(term)] : [];
  }
  return filterCommandsBySearchTerm({
    uf: createSearchEngine(),
    commands,
    previousResults: commands,
    searchTerm: query,
    previousSearchTerm: '',
  }).sort(compareCommandUsage);
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
