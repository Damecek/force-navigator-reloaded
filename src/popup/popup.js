/**
 * Popup script entry point: initializes popup UI on DOMContentLoaded.
 * @returns {void}
 */
document.addEventListener('DOMContentLoaded', () => {
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

  const guidedAuth = document.getElementById('guided-auth-link');
  if (guidedAuth) {
    guidedAuth.addEventListener('click', async (event) => {
      event.preventDefault();
      const tabs = await new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, resolve);
      });
      const activeTab = tabs?.[0];
      const params = new URLSearchParams();
      if (activeTab?.url) {
        try {
          params.set('host', new URL(activeTab.url).hostname);
        } catch {
          console.warn('Failed to parse active tab URL for Guided Auth');
        }
      }
      if (typeof activeTab?.id === 'number') {
        params.set('sourceTabId', String(activeTab.id));
      }
      const query = params.toString();
      const suffix = query ? `?${query}` : '';
      chrome.tabs.create({
        url: chrome.runtime.getURL(`authHelp.html${suffix}`),
        active: true,
      });
    });
  }
});
