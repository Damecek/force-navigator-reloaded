import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const CACHE_SCHEMA_VERSION = 1;
const CATALOG_VERSION = 2;
export const DEFAULT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Create a filename that isolates cached commands by org, user, and sources.
 * @param {{orgId: string, username: string, sources: string[], apiVersion: string}} scope Cache scope.
 * @returns {string}
 */
export function cacheFilename({ orgId, username, sources, apiVersion }) {
  const sourceSet = [...new Set(sources)].sort().join(',');
  const digest = createHash('sha256')
    .update(
      `${orgId}\0${username}\0${sourceSet}\0${apiVersion}\0${CATALOG_VERSION}`
    )
    .digest('hex');
  return `${digest}.json`;
}

const COMMAND_HOSTS = new Set(['core', 'lightning', 'setup']);

/**
 * Check that a cached command descriptor can be searched and turned into a URL.
 * @param {unknown} command Cached descriptor.
 * @returns {boolean}
 */
export function isValidCachedCommand(command) {
  return (
    command !== null &&
    typeof command === 'object' &&
    !Array.isArray(command) &&
    typeof command.id === 'string' &&
    command.id.length > 0 &&
    typeof command.label === 'string' &&
    typeof command.path === 'string' &&
    command.path.startsWith('/') &&
    (command.host === undefined || COMMAND_HOSTS.has(command.host))
  );
}

export class CatalogCache {
  /**
   * @param {{directory: string, ttlMs?: number, now?: () => number}} options Cache options.
   */
  constructor({ directory, ttlMs = DEFAULT_CACHE_TTL_MS, now = Date.now }) {
    this.directory = directory;
    this.ttlMs = ttlMs;
    this.now = now;
  }

  /**
   * @param {{orgId: string, username: string, sources: string[], apiVersion: string}} scope Cache scope.
   * @returns {Promise<object|null>}
   */
  async read(scope) {
    const path = join(this.directory, cacheFilename(scope));
    try {
      const value = JSON.parse(await readFile(path, 'utf8'));
      if (
        value === null ||
        typeof value !== 'object' ||
        Array.isArray(value) ||
        value.schemaVersion !== CACHE_SCHEMA_VERSION ||
        value.catalogVersion !== CATALOG_VERSION ||
        !Number.isFinite(value.createdAt) ||
        this.now() - value.createdAt >= this.ttlMs ||
        !Array.isArray(value.commands) ||
        !value.commands.every(isValidCachedCommand) ||
        !Array.isArray(value.errors)
      ) {
        return null;
      }
      return value;
    } catch (error) {
      if (error?.code === 'ENOENT' || error instanceof SyntaxError) {
        return null;
      }
      throw error;
    }
  }

  /**
   * @param {{orgId: string, username: string, sources: string[], apiVersion: string}} scope Cache scope.
   * @param {{commands: object[], errors: object[]}} catalog Catalog data.
   * @returns {Promise<object>}
   */
  async write(scope, catalog) {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const value = {
      schemaVersion: CACHE_SCHEMA_VERSION,
      catalogVersion: CATALOG_VERSION,
      createdAt: this.now(),
      commands: catalog.commands,
      errors: catalog.errors,
    };
    const path = join(this.directory, cacheFilename(scope));
    const temporaryPath = `${path}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(value)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
    await rename(temporaryPath, path);
    return value;
  }
}
