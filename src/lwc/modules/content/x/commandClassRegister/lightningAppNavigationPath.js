const PRESERVABLE_LIGHTNING_WORKSPACE_PATH_PREFIXES = [
  '/lightning/o/',
  '/lightning/r/',
  '/lightning/page/',
];

/**
 * Check whether a Lightning path should be preserved when switching apps.
 * @param {string} pathname Current browser pathname.
 * @returns {boolean}
 */
export function isPreservableLightningWorkspacePath(pathname) {
  return PRESERVABLE_LIGHTNING_WORKSPACE_PATH_PREFIXES.some((prefix) =>
    pathname?.startsWith(prefix)
  );
}

/**
 * Build a Lightning app path, preserving the current workspace page when safe.
 * @param {string} appTarget Lightning app target, for example c__Sales.
 * @param {{pathname: string, search?: string, hash?: string}} location
 * @returns {string}
 */
export function buildLightningAppNavigationPath(appTarget, location) {
  const appHomePath = `/lightning/app/${appTarget}`;
  if (!isPreservableLightningWorkspacePath(location?.pathname)) {
    return appHomePath;
  }

  const pageReferencePath = location.pathname.replace(/^\/lightning/, '');
  return `${appHomePath}${pageReferencePath}${location.search || ''}${
    location.hash || ''
  }`;
}
