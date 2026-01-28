/**
 * Get a localized message from the Chrome i18n API.
 * @param {string} key
 * @param {string|string[]=} substitutions
 * @returns {string}
 */
export function getMessage(key, substitutions) {
  const message = chrome?.i18n?.getMessage
    ? chrome.i18n.getMessage(key, substitutions)
    : '';
  return message || key;
}

/**
 * Create a map of localized labels from a list of keys.
 * @param {string[]} keys
 * @returns {Record<string, string>}
 */
export function getLabels(keys) {
  if (!Array.isArray(keys)) {
    return {};
  }
  return keys.reduce((labels, key) => {
    if (key) {
      labels[key] = getMessage(key);
    }
    return labels;
  }, {});
}

/**
 * Apply localized messages to elements with data attributes.
 * @param {Document|HTMLElement} root
 * @returns {void}
 */
export function applyI18n(root) {
  if (!root?.querySelectorAll) {
    return;
  }

  root.querySelectorAll('[data-i18n]').forEach((element) => {
    const key = element.getAttribute('data-i18n');
    if (!key) {
      return;
    }
    const message = getMessage(key);
    if (message) {
      element.textContent = message;
    }
  });

  root.querySelectorAll('[data-i18n-attr]').forEach((element) => {
    const mapping = element.getAttribute('data-i18n-attr');
    if (!mapping) {
      return;
    }
    mapping
      .split(';')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .forEach((entry) => {
        const [attr, key] = entry.split(':').map((value) => value.trim());
        if (!attr || !key) {
          return;
        }
        const message = getMessage(key);
        if (message) {
          element.setAttribute(attr, message);
        }
      });
  });
}
