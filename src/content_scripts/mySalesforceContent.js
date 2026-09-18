import {
  AUTOLOGIN_SETTINGS_KEY,
  Channel,
  CHANNEL_AUTOLOGIN_MYDOMAIN,
  CHANNEL_OPEN_AUTH_HELP,
  CHANNEL_REPORT_OAUTH_ERROR_PAGE,
  getSetting,
} from '../shared/index.js';
import { isLoginContextPage } from './mySalesforceLoginDetection.js';
import { parseOauthErrorPage } from './oauthErrorPageDetection.js';
import { renderOauthErrorHelpPanel } from './oauthErrorHelpPanel.js';

const oauthError = parseOauthErrorPage(window.location);
if (oauthError) {
  void reportOauthErrorPage(oauthError);
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

/**
 * Report the Salesforce OAuth error page and, when it belongs to this
 * extension's authorization attempt, explain the failure in place.
 * @param {import('./oauthErrorPageDetection.js').OauthErrorPageReport} report
 * @returns {Promise<void>}
 */
async function reportOauthErrorPage(report) {
  const failure = await new Channel(CHANNEL_REPORT_OAUTH_ERROR_PAGE).request(
    report
  );
  if (!failure?.confirmed) {
    console.log('OAuth error page does not belong to an active attempt');
    return;
  }
  renderOauthErrorHelpPanel({
    failure,
    onOpenHelp: async () => {
      try {
        await new Channel(CHANNEL_OPEN_AUTH_HELP).publish();
        return true;
      } catch (error) {
        console.error('Failed to open authorization help', error);
        return false;
      }
    },
  });
}
