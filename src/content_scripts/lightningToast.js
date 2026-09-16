/* eslint-disable @lwc/lwc-platform/no-aura */
/**
 * Page-context Salesforce toast handler.
 *
 * Content scripts cannot access `window.$A`, so they dispatch DOM events that
 * this handler receives in the page context. `forceNavigatorShowToast` fires
 * the native `force:showToast` event and prevents the default to signal that
 * the host displayed the toast. `forceNavigatorDismissToasts` closes toasts
 * previously shown by this handler. Clicks on the extension's help link inside
 * a toast are forwarded as `forceNavigatorOpenAuthHelp`.
 */
(() => {
  const SHOW_EVENT = 'forceNavigatorShowToast';
  const DISMISS_EVENT = 'forceNavigatorDismissToasts';
  const OPEN_HELP_EVENT = 'forceNavigatorOpenAuthHelp';
  const shownTitles = new Set();
  let helpUrl = null;

  function getAura() {
    const aura = window.$A;
    return aura && typeof aura.get === 'function' ? aura : null;
  }

  document.addEventListener(SHOW_EVENT, (event) => {
    const detail = event.detail;
    if (!detail || typeof detail.title !== 'string') {
      return;
    }
    const aura = getAura();
    if (!aura) {
      return;
    }
    try {
      const toastEvent = aura.get('e.force:showToast');
      if (!toastEvent) {
        return;
      }
      const params = {
        title: detail.title,
        message: detail.message,
        type: detail.variant || 'info',
        mode: detail.mode || 'dismissible',
      };
      if (typeof detail.duration === 'number') {
        params.duration = detail.duration;
      }
      if (detail.helpLabel && detail.helpUrl) {
        helpUrl = detail.helpUrl;
        params.messageTemplate = `${detail.message} {0}`;
        params.messageTemplateData = [
          { url: detail.helpUrl, label: detail.helpLabel },
        ];
      }
      const fire = () => {
        toastEvent.setParams(params);
        toastEvent.fire();
      };
      if (typeof aura.getCallback === 'function') {
        aura.getCallback(fire)();
      } else {
        fire();
      }
      shownTitles.add(detail.title);
      if (params.mode !== 'sticky' && typeof params.duration === 'number') {
        setTimeout(() => closeToastsByTitle([detail.title]), params.duration);
      }
      event.preventDefault();
    } catch (error) {
      console.error('Force Navigator toast failed:', error.message);
    }
  });

  /**
   * Close rendered toasts whose title matches. Lightning does not always
   * auto-dismiss timed toasts, so brief toasts are closed explicitly.
   * @param {string[]} titles
   * @returns {number} Number of toasts closed.
   */
  function closeToastsByTitle(titles) {
    let closed = 0;
    document.querySelectorAll('.forceToastMessage').forEach((toast) => {
      const title = toast.querySelector('.toastTitle')?.textContent?.trim();
      if (!title || !titles.includes(title)) {
        return;
      }
      const close = toast.querySelector(
        'button.toastClose, button[title="Close"]'
      );
      if (close) {
        close.click();
        closed += 1;
      }
    });
    return closed;
  }

  document.addEventListener(DISMISS_EVENT, (event) => {
    const titles = Array.isArray(event.detail?.titles)
      ? event.detail.titles
      : [...shownTitles];
    const toasts = document.querySelectorAll('.forceToastMessage');
    let closed = 0;
    toasts.forEach((toast) => {
      const title = toast.querySelector('.toastTitle')?.textContent?.trim();
      if (!title || !titles.includes(title)) {
        return;
      }
      const close = toast.querySelector(
        'button.toastClose, button[title="Close"]'
      );
      if (close) {
        close.click();
        closed += 1;
      }
    });
    if (closed > 0) {
      event.preventDefault();
    }
  });

  document.addEventListener(
    'click',
    (event) => {
      if (!helpUrl) {
        return;
      }
      const anchor = event.target?.closest?.('a[href]');
      if (!anchor || anchor.href !== helpUrl) {
        return;
      }
      if (!anchor.closest('.forceToastMessage')) {
        return;
      }
      const forwarded = document.dispatchEvent(
        new CustomEvent(OPEN_HELP_EVENT, { cancelable: true })
      );
      if (!forwarded) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    true
  );
})();
