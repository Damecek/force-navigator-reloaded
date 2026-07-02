const USERNAME_INPUT_SELECTOR =
  'input#username, input[name="username"], input[name="un"]';
const PASSWORD_INPUT_SELECTOR =
  'input#password, input[name="password"], input[name="pw"]';
const LOGIN_FORM_SELECTOR = 'form#login_form, form[name="login"]';
const LOGIN_SUBMIT_SELECTOR =
  'input#Login[type="submit"], input[name="Login"][type="submit"], button#Login, button[name="Login"]';

/**
 * Returns whether the current document looks like a Salesforce My Domain login prompt.
 * @param {Document} documentRef
 * @returns {boolean}
 */
export function isSalesforceLoginPrompt(documentRef) {
  const hasUsername = !!documentRef.querySelector(USERNAME_INPUT_SELECTOR);
  if (!hasUsername) {
    return false;
  }

  const hasPassword = !!documentRef.querySelector(PASSWORD_INPUT_SELECTOR);
  const hasSalesforceLoginSubmit =
    !!documentRef.querySelector(LOGIN_FORM_SELECTOR) &&
    !!documentRef.querySelector(LOGIN_SUBMIT_SELECTOR);

  return hasPassword || hasSalesforceLoginSubmit;
}

/**
 * Returns whether the current page should trigger My Domain auto-login.
 * @param {object} [context]
 * @param {Location} [context.location]
 * @param {Document} [context.document]
 * @param {Storage} [context.sessionStorage]
 * @param {() => number} [context.now]
 * @returns {boolean}
 */
export function isLoginContextPage({
  location = window.location,
  document: documentRef = document,
  sessionStorage: sessionStorageRef = sessionStorage,
  now = Date.now,
} = {}) {
  const { hostname, pathname, search } = location;
  if (!hostname.endsWith('.my.salesforce.com')) {
    return false;
  }

  if (pathname.endsWith('/secur/frontdoor.jsp')) {
    return false;
  }

  if (pathname.startsWith('/lightning')) {
    return false;
  }

  if (!isSalesforceLoginPrompt(documentRef)) {
    return false;
  }

  const key = `forceNavigatorAutoLoginAttempted:${hostname}${pathname}${search}`;
  const TEN_MINUTES = 10 * 60 * 1000;
  const lastAttempt = sessionStorageRef.getItem(key);
  if (lastAttempt && now() - Number(lastAttempt) < TEN_MINUTES) {
    return false;
  }
  sessionStorageRef.setItem(key, String(now()));
  return true;
}
