/* eslint-disable camelcase */
import { refreshToken } from './auth/auth.js';
import {
  buildAuthorizationHeaders,
  REAUTHORIZATION_REQUIRED_CODE,
} from './auth/requestAuthorization.js';
import {
  SALESFORCE_API_VERSION,
  toLightningHostname,
} from '../shared/index.js';

/**
 * Check whether an error means token refresh failed and re-authorization is required.
 * @param {unknown} error
 * @returns {boolean}
 */
export function isAuthRefreshFailedError(error) {
  return error?.code === REAUTHORIZATION_REQUIRED_CODE;
}

export class SalesforceConnection {
  /**
   * @param {object} opts
   * @param {string} opts.instanceUrl   https://<org>.my.salesforce.com
   * @param {import('./auth/auth.js').Token} [opts.token] Stored grant; a DPoP-bound grant signs every request.
   * @param {string} [opts.accessToken] Bearer access token, used when no grant is passed.
   * @param {string} [opts.version] Salesforce API version override.
   */
  constructor({
    instanceUrl,
    token,
    accessToken,
    version = SALESFORCE_API_VERSION,
  }) {
    this.origin = instanceUrl.replace(/\/$/, '');
    this.base = `${this.origin}/services/data/v${version}`;
    this.hostname = toLightningHostname(instanceUrl);
    this.token = token || {
      access_token: accessToken,
      instance_url: this.origin,
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
    const url = path.startsWith('/services/data/')
      ? `${this.origin}${path}`
      : `${this.base}${path}`;
    const requestToken = this.token;
    const res = await fetch(url, {
      headers: {
        ...(await buildAuthorizationHeaders(requestToken, 'GET', url)),
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      if (res.status === tokenExpiredCode) {
        console.warn(
          'Salesforce GET',
          path,
          '→ 401 Unauthorized, refreshing token'
        );
        const token = await refreshToken(this.hostname, {
          rejectedAccessToken: requestToken.access_token,
        });
        if (!token) {
          const error = new Error(
            `Salesforce GET ${path} → 401: refresh token failed`
          );
          error.code = REAUTHORIZATION_REQUIRED_CODE;
          throw error;
        }
        this.token = token;
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
