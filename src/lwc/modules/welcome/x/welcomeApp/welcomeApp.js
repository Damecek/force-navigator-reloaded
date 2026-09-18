import { LightningElement, track } from 'lwc';
import {
  buildAdminInstallSteps,
  buildAdminInstructions,
  CONNECTED_APP_LABEL,
  CONTENT_SCRIPT_ENABLED_BASE_DOMAINS,
} from '../../../../../shared';

const LIGHTNING_URLS = CONTENT_SCRIPT_ENABLED_BASE_DOMAINS.map(
  (baseDomain) => `https://*${baseDomain}/*`
);
const APPLE_PLATFORM_REGEX = /(mac|iphone|ipad|ipod)/i;
const IPAD_OS_REGEX = /MacIntel/i;
const SALESFORCE_LOGIN_URL = 'https://login.salesforce.com/';
const AUTHORIZATION_HELP_HASH = '#authorization-help';

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
  @track copyStatus = '';
  _scrolledToHash = false;

  /**
   * Detect an open Lightning tab and follow hash changes to the help anchor.
   * @returns {void}
   */
  connectedCallback() {
    void this.setupLightningLink();
    window.addEventListener('hashchange', this._handleHashChange);
  }

  /**
   * @returns {void}
   */
  disconnectedCallback() {
    window.removeEventListener('hashchange', this._handleHashChange);
  }

  /**
   * Scroll to the requested help anchor once the template has rendered.
   * @returns {void}
   */
  renderedCallback() {
    if (this._scrolledToHash) {
      return;
    }
    this._scrolledToHash = true;
    this.scrollToAuthorizationHelpIfRequested();
  }

  /**
   * Connected app label administrators see for this build.
   * @returns {string}
   */
  get connectedAppLabel() {
    return CONNECTED_APP_LABEL;
  }

  /**
   * Administrator installation steps for the template loop.
   * @returns {{id: string, text: string}[]}
   */
  get adminSteps() {
    return buildAdminInstallSteps(CONNECTED_APP_LABEL).map((text, index) => ({
      id: `admin-step-${index}`,
      text,
    }));
  }

  /**
   * Copyable message for a Salesforce administrator.
   * @returns {string}
   */
  get adminInstructions() {
    return buildAdminInstructions({ appLabel: CONNECTED_APP_LABEL });
  }

  /**
   * Copy the administrator instructions to the clipboard.
   * @returns {Promise<void>}
   */
  async handleCopyAdminInstructions() {
    try {
      await navigator.clipboard.writeText(this.adminInstructions);
      this.copyStatus = 'Copied to clipboard.';
    } catch (error) {
      console.error('Clipboard write failed', error);
      this.selectAdminInstructions();
      this.copyStatus =
        'Clipboard access is unavailable. The text is selected, press Ctrl+C or Cmd+C.';
    }
  }

  /**
   * Select the instructions text as a manual copy fallback.
   * @returns {void}
   */
  selectAdminInstructions() {
    const target = this.refs.adminInstructions;
    if (!target) {
      return;
    }
    const range = document.createRange();
    range.selectNodeContents(target);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  _handleHashChange = () => {
    this.scrollToAuthorizationHelpIfRequested();
  };

  /**
   * Scroll to the authorization help from the in-page link, even when the hash is already set.
   * @param {MouseEvent} event
   * @returns {void}
   */
  handleAuthorizationHelpLinkClick(event) {
    event.preventDefault();
    if (window.location.hash !== AUTHORIZATION_HELP_HASH) {
      window.location.hash = AUTHORIZATION_HELP_HASH;
    }
    this.scrollToAuthorizationHelpIfRequested();
  }

  /**
   * Scroll to and focus the authorization help when the page was opened with its anchor.
   * @returns {void}
   */
  scrollToAuthorizationHelpIfRequested() {
    if (window.location.hash !== AUTHORIZATION_HELP_HASH) {
      return;
    }
    const target = this.refs.authorizationHelp;
    if (!target) {
      return;
    }
    target.scrollIntoView({ block: 'start' });
    target.focus({ preventScroll: true });
  }

  /**
   * Render shortcut text according to current platform.
   * @returns {string}
   */
  get shortcutText() {
    return isApplePlatform() ? 'Cmd+Shift+P' : 'Ctrl+Shift+L';
  }

  /**
   * Label the primary onboarding action according to the available browser context.
   * @returns {string}
   */
  get primaryActionLabel() {
    return this.hasLightningTab ? 'Try it in Salesforce' : 'Open Salesforce';
  }

  /**
   * Focus an existing Lightning tab or open Salesforce login.
   * @param {MouseEvent} [event]
   * @returns {void}
   */
  handleTryInSalesforceClick(event) {
    event?.preventDefault();
    if (typeof this.firstLightningTabId !== 'number') {
      chrome.tabs.create({ url: SALESFORCE_LOGIN_URL });
      return;
    }
    this.focusLightningTab();
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
    this.focusLightningTab();
  }

  /**
   * Focus the first Salesforce Lightning tab detected during onboarding.
   * @returns {void}
   */
  focusLightningTab() {
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
