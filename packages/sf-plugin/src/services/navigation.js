import { openAuthenticatedUrl } from './browser.js';

/**
 * Open a command through the target org's single-use authentication URL.
 * The authenticated URL stays inside this function and the injected opener.
 * @param {object} options Navigation options.
 * @param {import('@salesforce/core').Org} options.org Authenticated org.
 * @param {{path: string, url: string}} options.command Command with a destination path and URL.
 * @param {(url: string, browser?: string) => Promise<void>} [options.opener] URL opener.
 * @param {'chrome'|'edge'|'firefox'} [options.browser] Browser selection.
 * @returns {Promise<void>}
 */
export async function openNavigation({
  org,
  command,
  opener = openAuthenticatedUrl,
  browser,
}) {
  let authenticatedUrl;
  try {
    authenticatedUrl = await org.getFrontDoorUrl(command.path);
  } catch {
    throw new Error(
      'Unable to create an authenticated browser session for the target org.'
    );
  }
  await opener(authenticatedUrl, browser);
}
