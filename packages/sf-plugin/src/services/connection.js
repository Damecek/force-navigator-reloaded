import { Diagnostics } from './diagnostics.js';

/**
 * Collect every page returned by a JSforce query.
 * @param {Promise<object>|object} firstPage Query result or thenable query.
 * @param {(locator: string) => Promise<object>} queryMore Loads another page.
 * @returns {Promise<object[]>}
 */
export async function collectQueryRecords(firstPage, queryMore) {
  let page = await firstPage;
  const records = [];
  const seenLocators = new Set();

  while (page) {
    records.push(...(Array.isArray(page.records) ? page.records : []));
    if (page.done !== false) {
      break;
    }
    if (!page.nextRecordsUrl) {
      throw new Error(
        'Salesforce query returned an incomplete page without a locator.'
      );
    }
    if (seenLocators.has(page.nextRecordsUrl)) {
      throw new Error(
        'Salesforce query returned a repeated pagination locator.'
      );
    }
    seenLocators.add(page.nextRecordsUrl);
    page = await queryMore(page.nextRecordsUrl);
  }

  return records;
}

/**
 * Adapt a Salesforce Core Org to the navigator's minimal query interface.
 * @param {import('@salesforce/core').Org} org Authenticated Salesforce org.
 * @param {string} apiVersion Pinned Salesforce API version.
 * @param {Diagnostics} [diagnostics] Optional request timings.
 * @returns {{query: (soql: string) => Promise<object[]>, toolingQuery: (soql: string) => Promise<object[]>}}
 */
export function createNavigatorConnection(
  org,
  apiVersion,
  diagnostics = new Diagnostics()
) {
  const connection = org.getConnection(apiVersion);
  const query = async (api, client, soql) => {
    const object =
      /\bFROM\s+([a-zA-Z][a-zA-Z0-9_]*)/i.exec(soql)?.[1] ?? 'query';
    const paging = [...soql.matchAll(/\b(LIMIT|OFFSET)\s+(\d+)/gi)]
      .map(([, key, value]) => ` ${key.toUpperCase()} ${value}`)
      .join('');
    let page = 1;
    const request = (run) =>
      diagnostics.measure(
        `${api} ${object}${paging} page ${page++}`,
        run,
        (result) =>
          `${Array.isArray(result?.records) ? result.records.length : 0} records`
      );
    return collectQueryRecords(
      request(() => client.query(soql)),
      (locator) => request(() => client.queryMore(locator))
    );
  };
  return {
    query: (soql) => query('REST', connection, soql),
    toolingQuery: (soql) => query('Tooling', connection.tooling, soql),
  };
}
