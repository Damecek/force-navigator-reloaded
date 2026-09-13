import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Local command counts, isolated from catalog refreshes and Chrome history. */
export class CommandHistory {
  /**
   * @param {{directory: string, orgId: string, username: string}} options Storage scope.
   */
  constructor({ directory, orgId, username }) {
    this.directory = directory;
    const scope = createHash('sha256')
      .update(`${orgId}\0${username}`)
      .digest('hex');
    this.path = join(directory, `${scope}.json`);
  }

  /** @returns {Promise<Record<string, number>>} Valid usage counts, or an empty history. */
  async read() {
    try {
      const value = JSON.parse(await readFile(this.path, 'utf8'));
      if (!value || typeof value !== 'object' || Array.isArray(value))
        return {};
      return Object.fromEntries(
        Object.entries(value).filter(
          ([, count]) => Number.isSafeInteger(count) && count > 0
        )
      );
    } catch (error) {
      if (error?.code === 'ENOENT' || error instanceof SyntaxError) return {};
      throw error;
    }
  }

  /**
   * Record a successful catalog command. Search terms and credentials are never stored.
   * @param {string} id Catalog command ID.
   * @returns {Promise<void>}
   */
  async record(id) {
    if (id === 'search-records') return;
    const counts = await this.read();
    const previous = Object.hasOwn(counts, id) ? counts[id] : 0;
    const next = {
      ...counts,
      [id]: Math.min(previous + 1, Number.MAX_SAFE_INTEGER),
    };
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const temporary = `${this.path}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, `${JSON.stringify(next)}\n`, { mode: 0o600 });
      await rename(temporary, this.path);
    } finally {
      await rm(temporary, { force: true });
    }
  }
}
