const ACTIONS = {
  OPEN_SHORTCUTS: 'open-shortcuts',
  OPEN_OPTIONS: 'open-options',
};
const LIGHTNING_URLS = [
  'https://*.lightning.force.com/*',
  'https://*.force.com/*',
  'https://*.salesforce-setup.com/*',
  'https://*.builder.salesforce-experience.com/*',
];
const APPLE_PLATFORM_REGEX = /(mac|iphone|ipad|ipod)/i;
const IPAD_OS_REGEX = /MacIntel/i;
let firstLightningTabId = null;

/**
 * Open a Chrome internal page in a new tab.
 * @param {string} url
 * @returns {void}
 */
function openChromePage(url) {
  chrome.tabs.create({ url });
}

/**
 * Handle clicks on action buttons.
 * @param {MouseEvent} event
 * @returns {void}
 */
function handleActionClick(event) {
  const target = event.currentTarget;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const action = target.dataset.action;
  if (!action) {
    return;
  }
  if (action === ACTIONS.OPEN_SHORTCUTS) {
    openChromePage('chrome://extensions/shortcuts');
  }
  if (action === ACTIONS.OPEN_OPTIONS) {
    chrome.runtime.openOptionsPage();
  }
}

/**
 * Attach click handlers only to explicit action elements.
 * @returns {void}
 */
function setupActionListeners() {
  const actionElements = document.querySelectorAll('[data-action]');
  actionElements.forEach((element) => {
    element.addEventListener('click', handleActionClick);
  });
}

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
 * Render shortcut text according to current platform.
 * @returns {void}
 */
function setupShortcutCopy() {
  const shortcutElement = document.getElementById('command-palette-shortcut');
  if (!shortcutElement) {
    return;
  }
  if (isApplePlatform()) {
    shortcutElement.textContent = 'Cmd+Shift+P';
    return;
  }
  shortcutElement.textContent = 'Ctrl+Shift+L';
}

/**
 * Focus the first detected Lightning tab.
 * @param {MouseEvent} event
 * @returns {void}
 */
function handleOpenLightningLinkClick(event) {
  event.preventDefault();
  if (typeof firstLightningTabId !== 'number') {
    return;
  }
  chrome.tabs.update(firstLightningTabId, { active: true }, (tab) => {
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
async function setupLightningLink() {
  const link = document.getElementById('open-lightning-link');
  if (!link) {
    return;
  }
  link.addEventListener('click', handleOpenLightningLinkClick);
  const tabs = await new Promise((resolve) => {
    chrome.tabs.query({ url: LIGHTNING_URLS }, resolve);
  });
  const firstTab = tabs?.[0];
  if (!firstTab?.url || typeof firstTab.id !== 'number') {
    return;
  }
  firstLightningTabId = firstTab.id;
  link.hidden = false;
}

setupActionListeners();
setupShortcutCopy();
setupLightningLink();
