import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const packageLockUrl = new URL('../package-lock.json', import.meta.url);
const codeMirrorStatePath = 'node_modules/@codemirror/state';

const findCodeMirrorStateInstallations = (packages) =>
  Object.keys(packages).filter(
    (packagePath) =>
      packagePath === codeMirrorStatePath ||
      packagePath.endsWith(`/${codeMirrorStatePath}`)
  );

const assertSingleCodeMirrorStateInstallation = (packages) => {
  const installations = findCodeMirrorStateInstallations(packages);

  assert.deepEqual(
    installations,
    [codeMirrorStatePath],
    `Multiple @codemirror/state installations break CodeMirror extension identity checks. Found: ${installations.join(', ')}`
  );
};

test('CodeMirror dependency check rejects nested state installations', () => {
  assert.throws(
    () =>
      assertSingleCodeMirrorStateInstallation({
        [codeMirrorStatePath]: {},
        [`node_modules/@codemirror/view/${codeMirrorStatePath}`]: {},
      }),
    /Multiple @codemirror\/state installations/
  );
});

test('CodeMirror state has exactly one physical installation', async () => {
  const packageLock = JSON.parse(await readFile(packageLockUrl, 'utf8'));

  assertSingleCodeMirrorStateInstallation(packageLock.packages);
});
