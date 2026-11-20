import { buildAuthorizationHeaders } from './requestAuthorization.js';

const FRONTDOOR_PATH = '/secur/frontdoor.jsp';
const ERROR_CODE_PATTERN = /^[A-Za-z_]{1,40}$/;
const UNSAFE_PATH_CHARACTERS = /[\\\u0000-\u001f]/;

/**
 * Exchange a grant for a short-lived frontdoor URL through the Salesforce UI
 * Bridge API (`/services/oauth2/singleaccess`). The URL carries a one-time
 * code instead of the access token, and works for bearer and DPoP-bound grants.
 * The grant needs the `web` scope.
 * @param {import('./auth.js').Token} token
 * @param {string} redirectPath Relative path opened after the session starts.
 * @returns {Promise<string>}
 * @throws {Error} when the path is not relative, Salesforce refuses the request, or the response is not a frontdoor URL of the same org without a session id.
 */
export async function requestFrontdoorUrl(token, redirectPath) {
  if (!isRelativePath(redirectPath)) {
    throw new Error('UI session bridge requires a relative redirect path');
  }
  const origin = new URL(token.instance_url).origin;
  const endpoint = `${origin}/services/oauth2/singleaccess`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      ...(await buildAuthorizationHeaders(token, 'POST', endpoint)),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams([['redirect_uri', redirectPath]]).toString(),
    redirect: 'error',
  });
  if (!response.ok) {
    const code = (await response.text()).trim();
    throw new Error(
      `UI session bridge failed: ${response.status} ${ERROR_CODE_PATTERN.test(code) ? code : 'unreadable response'}`
    );
  }
  let frontdoor;
  try {
    frontdoor = new URL((await response.json()).frontdoor_uri);
  } catch {
    throw new Error('UI session bridge returned an unreadable response');
  }
  if (
    frontdoor.origin !== origin ||
    frontdoor.pathname !== FRONTDOOR_PATH ||
    frontdoor.username ||
    frontdoor.password ||
    frontdoor.searchParams.has('sid')
  ) {
    throw new Error('UI session bridge returned an unexpected URL');
  }
  return frontdoor.toString();
}

/**
 * @param {unknown} path
 * @returns {boolean} Whether the value is a path on the current origin. Network-path references, backslashes, and control characters are refused because URL parsers can read them as another host.
 */
export function isRelativePath(path) {
  return (
    typeof path === 'string' &&
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !UNSAFE_PATH_CHARACTERS.test(path)
  );
}
