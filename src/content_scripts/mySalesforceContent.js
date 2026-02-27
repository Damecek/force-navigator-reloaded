import {
  AUTOLOGIN_SETTINGS_KEY,
  Channel,
  CHANNEL_AUTOLOGIN_MYDOMAIN,
  getSetting,
} from '../shared';

function isLoginContextPage() {
  const { hostname, pathname, search } = window.location;
  if (!hostname.endsWith('.my.salesforce.com')) {
    return false;
  }

  // Prevent loops on our own redirect target.
  if (pathname.endsWith('/secur/frontdoor.jsp')) {
    return false;
  }

  // Avoid running on authenticated Lightning routes.
  if (pathname.startsWith('/lightning')) {
    return false;
  }

  // Both known login variants contain username/password inputs, sometimes hidden.
  const hasUsername = !!document.querySelector(
    'input#username, input[name="username"], input[name="un"]'
  );
  const hasPassword = !!document.querySelector(
    'input#password, input[name="password"], input[name="pw"]'
  );
  if (!hasUsername || !hasPassword) {
    return false;
  }

  const key = `forceNavigatorAutoLoginAttempted:${hostname}${pathname}${search}`;
  if (sessionStorage.getItem(key) === '1') {
    return false;
  }
  sessionStorage.setItem(key, '1');
  return true;
}

void getSetting([AUTOLOGIN_SETTINGS_KEY]).then((autologinEnabled) => {
  if (autologinEnabled !== true) {
    return;
  }
  if (isLoginContextPage()) {
    new Channel(CHANNEL_AUTOLOGIN_MYDOMAIN).publish();
  }
});
