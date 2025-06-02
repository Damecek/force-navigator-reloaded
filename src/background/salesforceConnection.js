export class SalesforceConnection {
  /**
   * @param {object} opts
   * @param {string} opts.instanceUrl   https://<org>.my.salesforce.com
   * @param {string} opts.accessToken   sid / OAuth bearer
   * @param {string} [opts.version='60.0']
   */
  constructor({ instanceUrl, accessToken, version = '60.0' }) {
    this.base = `${instanceUrl.replace(/\/$/, '')}/services/data/v${version}`;
    this.headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  /* ───────── SOQL & Tooling ───────── */

  /** Run a SOQL query and return *all* records (handles pagination). */
  async query(soql) {
    return this._queryLoop(`/query/?q=${encodeURIComponent(soql)}`);
  }

  /** Run a Tooling SOQL query. */
  async toolingQuery(soql) {
    return this._queryLoop(`/tooling/query/?q=${encodeURIComponent(soql)}`);
  }

  /* ───────── basic helpers ───────── */
  async _get(path) {
    const res = await fetch(`${this.base}${path}`, { headers: this.headers });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`Salesforce GET ${path} → ${res.status}: ${msg}`);
    }
    return res.json();
  }

  /* ───────── private pagination loop ───────── */

  async _queryLoop(initialPath) {
    let url = initialPath,
      records = [];
    do {
      const data = await this._get(url);
      records = records.concat(data.records || []);
      url = data.nextRecordsUrl ?? null;
    } while (url);
    return records;
  }
}
