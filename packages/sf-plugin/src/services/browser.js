import open, { apps } from 'open';

const BROWSER_APPS = {
  chrome: apps.chrome,
  edge: apps.edge,
  firefox: apps.firefox,
};

/**
 * Open an authenticated URL without returning or logging it.
 * @param {string} authenticatedUrl Single-use authenticated URL.
 * @param {'chrome'|'edge'|'firefox'} [browser] Browser selection.
 * @param {(url: string, options: object) => Promise<import('node:child_process').ChildProcess>} [launch] Browser launcher.
 * @returns {Promise<void>}
 */
export async function openAuthenticatedUrl(
  authenticatedUrl,
  browser,
  launch = open
) {
  const options = browser ? { app: { name: BROWSER_APPS[browser] } } : {};
  let child;
  try {
    child = await launch(authenticatedUrl, options);
  } catch {
    throw new Error('Unable to launch the browser.');
  }

  if (child.exitCode !== null && child.exitCode !== undefined) {
    if (child.exitCode !== 0) {
      throw new Error('Unable to launch the selected browser.');
    }
    return;
  }

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, 1000);
    child.once('error', () => {
      clearTimeout(timeout);
      reject(new Error('Unable to launch the browser.'));
    });
    child.once('close', (code) => {
      clearTimeout(timeout);
      if (code && code !== 0) {
        reject(new Error('Unable to launch the selected browser.'));
      } else {
        resolve();
      }
    });
  });
}
