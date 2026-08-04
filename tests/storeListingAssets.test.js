import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

const projectRoot = new URL('../', import.meta.url);
const manifestUrl = new URL('src/manifest.json', projectRoot);
const screenshotDirectoryUrl = new URL(
  'web/store-assets/screenshots/',
  projectRoot
);

test('Chrome Web Store title and summary stay within manifest limits', async () => {
  const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));

  assert.ok(manifest.name.length <= 45);
  assert.match(manifest.name, /Salesforce/);
  assert.ok(manifest.description.length <= 132);
  assert.match(manifest.description, /Salesforce command palette/);
  assert.match(manifest.description, /shortcuts/);
});

test('Chrome Web Store screenshot set contains five 1280x800 PNG files', async () => {
  const filenames = (await readdir(screenshotDirectoryUrl))
    .filter((filename) => filename.endsWith('.png'))
    .sort();

  assert.equal(filenames.length, 5);
  for (const filename of filenames) {
    const png = await readFile(new URL(filename, screenshotDirectoryUrl));
    assert.equal(png.toString('ascii', 1, 4), 'PNG');
    assert.equal(png.readUInt32BE(16), 1280);
    assert.equal(png.readUInt32BE(20), 800);
  }
});
