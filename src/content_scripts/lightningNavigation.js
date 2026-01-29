/**
 * Page-context Aura navigation handler.
 *
 * Content scripts cannot access `window.$A`, so they dispatch a DOM event which
 * this handler receives in the page context. When Aura navigation succeeds, it
 * prevents the default to signal success; otherwise it falls back to a full
 * page navigation.
 *
 * @param {CustomEvent<string>} event - DOM event carrying the URL in detail.
 */
document.addEventListener('forceNavigatorNavigate', (event) => {
  const url = event.detail;
  if (typeof url !== 'string' || !url) {
    return;
  }
  try {
    const aura = window.$A;
    if (!aura || typeof aura.get !== 'function') {
      throw new Error('Aura framework not available');
    }
    const navigationEvent = aura.get('e.force:navigateToURL');
    if (!navigationEvent) {
      throw new Error('Aura navigation event unavailable');
    }
    navigationEvent.setParams({ url });
    navigationEvent.fire();
  } catch (error) {
    console.error(
      'Lightning navigation failed, falling back to default navigation:',
      error.message
    );
    window.location.href;
  }
  event.preventDefault();
});
