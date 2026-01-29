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
    event.preventDefault();
  } catch (error) {
    console.error(
      'Lightning navigation failed, falling back to default navigation:',
      error.message
    );
    window.open(url, '_top');
    event.preventDefault();
  }
});
