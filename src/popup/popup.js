import { applyI18n, getMessage } from '../shared';

/**
 * Popup script entry point: initializes popup UI on DOMContentLoaded.
 * @returns {void}
 */
document.addEventListener('DOMContentLoaded', () => {
  applyI18n(document);
  const pageTitle = getMessage('extensionName');
  if (pageTitle) {
    document.title = pageTitle;
  }
  if (chrome?.i18n?.getUILanguage) {
    document.documentElement.lang = chrome.i18n.getUILanguage();
  }
  const settings = document.getElementById('settings-link');
  if (settings) {
    settings.addEventListener('click', (event) => {
      event.preventDefault();
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      }
    });
  }

  const shortcuts = document.getElementById('shortcuts-link');
  if (shortcuts) {
    shortcuts.addEventListener('click', (event) => {
      event.preventDefault();
      chrome.tabs.create({
        url: 'chrome://extensions/shortcuts',
        active: true,
      });
    });
  }
});
