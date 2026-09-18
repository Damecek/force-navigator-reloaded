/**
 * Inject an extension script into the page context.
 *
 * Content scripts run in an isolated world and cannot reach page globals such
 * as the Aura runtime (`window.$A`). Injecting a web-accessible script tag runs
 * the handler in the page context; the content script then talks to it through
 * DOM events.
 *
 * @param {string} fileName Web-accessible resource, for example `lightningToast.js`.
 * @param {string} marker Dataset marker preventing duplicate injection.
 * @returns {void}
 */
export function injectPageScript(fileName, marker) {
  const markerKey = toCamelCase(marker);
  if (document.documentElement.dataset[markerKey]) {
    return;
  }
  document.documentElement.dataset[markerKey] = 'true';
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL(fileName);
  script.type = 'text/javascript';
  script.addEventListener('load', () => {
    script.remove();
  });
  document.documentElement.appendChild(script);
}

/**
 * Convert a `data-*` marker name to its dataset property name.
 * @param {string} value
 * @returns {string}
 */
function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}
