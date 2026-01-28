import { createElement } from 'lwc';
import OptionsApp from 'x/optionsApp';
import { getMessage } from '../shared';

/**
 * Mount the options page LWC component once DOM is ready.
 * @returns {void}
 */
document.addEventListener('DOMContentLoaded', () => {
  const title = getMessage('optionsPageTitle');
  if (title) {
    document.title = title;
  }
  if (chrome?.i18n?.getUILanguage) {
    document.documentElement.lang = chrome.i18n.getUILanguage();
  }
  const elm = createElement('x-options-app', { is: OptionsApp });
  document.body.appendChild(elm);
});
