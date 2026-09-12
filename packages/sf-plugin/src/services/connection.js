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
 * @returns {{query: (soql: string) => Promise<object[]>, toolingQuery: (soql: string) => Promise<object[]>}}
 */
export function createNavigatorConnection(org, apiVersion) {
  const connection = org.getConnection(apiVersion);
  return {
    query: async (soql) =>
      collectQueryRecords(connection.query(soql), async (locator) =>
        connection.queryMore(locator)
      ),
    toolingQuery: async (soql) =>
      collectQueryRecords(connection.tooling.query(soql), async (locator) =>
        connection.tooling.queryMore(locator)
      ),
  };
}
