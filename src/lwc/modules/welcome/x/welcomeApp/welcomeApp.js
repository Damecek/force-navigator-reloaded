import { LightningElement } from 'lwc';
import { CONTENT_SCRIPT_ENABLED_BASE_DOMAINS } from '../../../../../shared';

const LIGHTNING_URLS = CONTENT_SCRIPT_ENABLED_BASE_DOMAINS.map(
  (baseDomain) => `https://*${baseDomain}/*`
);
const APPLE_PLATFORM_REGEX = /(mac|iphone|ipad|ipod)/i;
const IPAD_OS_REGEX = /MacIntel/i;

/**
 * Return true when running on Apple platform (Mac/iOS/iPadOS).
 * @returns {boolean}
 */
function isApplePlatform() {
  const userAgentDataPlatform = navigator.userAgentData?.platform;
  if (
    typeof userAgentDataPlatform === 'string' &&
    APPLE_PLATFORM_REGEX.test(userAgentDataPlatform)
  ) {
    return true;
  }
  if (APPLE_PLATFORM_REGEX.test(navigator.platform)) {
    return true;
  }
  return (
    IPAD_OS_REGEX.test(navigator.platform) &&
    typeof navigator.maxTouchPoints === 'number' &&
    navigator.maxTouchPoints > 1
  );
}

/**
 * Root component for the welcome page.
 */
export default class WelcomeApp extends LightningElement {
  static renderMode = 'light';

  firstLightningTabId = null;
  hasLightningTab = false;

  connectedCallback() {
    void this.setupLightningLink();
  }

  /**
   * Render shortcut text according to current platform.
   * @returns {string}
   */
  get shortcutText() {
    return isApplePlatform() ? 'Cmd+Shift+P' : 'Ctrl+Shift+L';
  }

  /**
   * Open extension settings page.
   * @returns {void}
   */
  handleOpenOptionsClick() {
    chrome.runtime.openOptionsPage();
  }

  /**
   * Open Chrome shortcut settings page.
   * @returns {void}
   */
  handleOpenShortcutsClick() {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  }

  /**
   * Focus the first detected Lightning tab.
   * @param {MouseEvent} event
   * @returns {void}
   */
  handleOpenLightningLinkClick(event) {
    event.preventDefault();
    if (typeof this.firstLightningTabId !== 'number') {
      return;
    }
    chrome.tabs.update(this.firstLightningTabId, { active: true }, (tab) => {
      if (chrome.runtime.lastError || !tab) {
        return;
      }
      if (typeof tab.windowId !== 'number') {
        return;
      }
      chrome.windows.update(
        tab.windowId,
        { focused: true, state: 'normal' },
        () => {
          if (chrome.runtime.lastError) {
            return;
          }
        }
      );
    });
  }

  /**
   * Show a link to the first Lightning tab found in the current browser session.
   * @returns {Promise<void>}
   */
  async setupLightningLink() {
    const tabs = await new Promise((resolve) => {
      chrome.tabs.query({ url: LIGHTNING_URLS }, resolve);
    });
    const firstTab = tabs?.[0];
    if (!firstTab?.url || typeof firstTab.id !== 'number') {
      return;
    }
    this.firstLightningTabId = firstTab.id;
    this.hasLightningTab = true;
  }
}
