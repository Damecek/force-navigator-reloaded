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
});
