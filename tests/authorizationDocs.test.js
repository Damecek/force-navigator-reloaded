import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readmeUrl = new URL('../README.md', import.meta.url);
const listingUrl = new URL('../web/web-store-listing.md', import.meta.url);
const popupUrl = new URL('../src/popup/popup.html', import.meta.url);

test('README explains administrator installation and drops the "nothing else is required" claim', async () => {
  const readme = await readFile(readmeUrl, 'utf8');
  assert.match(readme, /^## Authorization & Connected Apps$/m);
  assert.doesNotMatch(readme, /nothing else is required/);
  assert.match(readme, /app must be installed into org/);
  assert.match(readme, /Connected Apps OAuth Usage/);
  assert.match(readme, /\*\*Allowed\*\* does not mean \*\*Installed\*\*/);
  assert.match(readme, /Force Navigator Reloaded Prod/);
  assert.match(readme, /Force Navigator Reloaded Dev/);
  assert.match(readme, /assign the user's profile or a permission set/);
  assert.doesNotMatch(readme, /VPN|identity verification|frozen/i);
});

test('store listing describes authorization and the administrator prerequisite in unwrapped paragraphs', async () => {
  const listing = await readFile(listingUrl, 'utf8');
  assert.match(listing, /^• Authorize once per org$/m);
  const paragraph = listing
    .split('\n')
    .find((line) => line.startsWith('Run Extension > Authorize'));
  assert.ok(paragraph, 'authorization paragraph exists on one line');
  assert.match(paragraph, /Force Navigator Reloaded Prod/);
  assert.match(paragraph, /Connected Apps OAuth Usage/);
  assert.doesNotMatch(listing, /VPN|identity verification|frozen/i);
});

test('popup links to the authorization help', async () => {
  const popup = await readFile(popupUrl, 'utf8');
  assert.match(popup, /id="authorization-help-link"/);
  assert.match(popup, /app must be installed into org/);
});
