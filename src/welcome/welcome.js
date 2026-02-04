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
  const target = event.target;
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

document.addEventListener('click', handleActionClick);

/**
 * Show a link to the first Lightning tab found in the current browser session.
 * @returns {Promise<void>}
 */
async function setupLightningLink() {
  const link = document.getElementById('open-lightning-link');
  if (!link) {
    return;
  }
  const tabs = await new Promise((resolve) => {
    chrome.tabs.query({ url: LIGHTNING_URLS }, resolve);
  });
  const firstTab = tabs?.[0];
  if (!firstTab?.url || !firstTab.id) {
    return;
  }
  link.hidden = false;
  link.addEventListener('click', (event) => {
    event.preventDefault();
    chrome.tabs.update(firstTab.id, { active: true });
  });
}

setupLightningLink();
