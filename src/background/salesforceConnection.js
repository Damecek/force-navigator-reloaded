import { refreshToken } from './auth/auth';
import { toLightningHostname } from '../shared';

const AUTH_REFRESH_FAILED_CODE = 'AUTH_REFRESH_FAILED';

/**
 * Check whether an error means token refresh failed and re-authorization is required.
 * @param {unknown} error
 * @returns {boolean}
 */
export function isAuthRefreshFailedError(error) {
  return error?.code === AUTH_REFRESH_FAILED_CODE;
}

export class SalesforceConnection {
  /**
   * @param {object} opts
   * @param {string} opts.instanceUrl   https://<org>.my.salesforce.com
   * @param {string} opts.accessToken   sid / OAuth bearer
   * @param {string} [opts.version='60.0']
   */
  constructor({ instanceUrl, accessToken, version = '62.0' }) {
    this.base = `${instanceUrl.replace(/\/$/, '')}/services/data/v${version}`;
    this.hostname = toLightningHostname(instanceUrl);
    this.headers = this.getHeaders(accessToken);
  }

  getHeaders(accessToken) {
    return {
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
  async _get(path, tokenExpiredCode = 401) {
    const res = await fetch(`${this.base}${path}`, { headers: this.headers });
    if (!res.ok) {
      if (res.status === tokenExpiredCode) {
        console.warn(
          'Salesforce GET',
          path,
          '→ 401 Unauthorized, refreshing token',
          this.headers.Authorization
        );
        const token = await refreshToken(this.hostname);
        if (!token) {
          const error = new Error(
            `Salesforce GET ${path} → 401: refresh token failed`
          );
          error.code = AUTH_REFRESH_FAILED_CODE;
          throw error;
        }
        this.headers = this.getHeaders(token.access_token);
        return this._get(path, 0);
      }
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
