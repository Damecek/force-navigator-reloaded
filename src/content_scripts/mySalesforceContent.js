import {
  AUTOLOGIN_SETTINGS_KEY,
  Channel,
  CHANNEL_AUTOLOGIN_MYDOMAIN,
  getSetting,
} from '../shared/index.js';
import { isLoginContextPage } from './mySalesforceLoginDetection.js';

void getSetting([AUTOLOGIN_SETTINGS_KEY]).then((autologinEnabled) => {
  if (autologinEnabled !== true) {
    return;
  }
  if (isLoginContextPage()) {
    new Channel(CHANNEL_AUTOLOGIN_MYDOMAIN).publish();
  }
});
