import {
  AUTOLOGIN_SETTINGS_KEY,
  Channel,
  CHANNEL_AUTOLOGIN_MYDOMAIN,
  CHANNEL_REPORT_OAUTH_ERROR_PAGE,
  getSetting,
} from '../shared/index.js';
import { isLoginContextPage } from './mySalesforceLoginDetection.js';
import { parseOauthErrorPage } from './oauthErrorPageDetection.js';

const oauthError = parseOauthErrorPage(window.location);
if (oauthError) {
  void new Channel(CHANNEL_REPORT_OAUTH_ERROR_PAGE).request(oauthError);
} else {
  void getSetting([AUTOLOGIN_SETTINGS_KEY]).then((autologinEnabled) => {
    if (autologinEnabled !== true) {
      return;
    }
    if (isLoginContextPage()) {
      new Channel(CHANNEL_AUTOLOGIN_MYDOMAIN).publish();
    }
  });
}
