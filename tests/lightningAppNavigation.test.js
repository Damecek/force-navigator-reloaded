import test from 'node:test';
import assert from 'node:assert/strict';

async function loadNavigationModule() {
  return import(
    `../src/lwc/modules/content/x/commandClassRegister/lightningAppNavigationPath.js?test=${Date.now()}-${Math.random()}`
  );
}

test('buildLightningAppNavigationPath preserves object list pages', async () => {
  const { buildLightningAppNavigationPath } = await loadNavigationModule();

  const result = buildLightningAppNavigationPath('c__Sales', {
    pathname: '/lightning/o/Account/list',
    search: '?filterName=Recent',
    hash: '',
  });

  assert.equal(
    result,
    '/lightning/app/c__Sales/o/Account/list?filterName=Recent'
  );
});

test('buildLightningAppNavigationPath preserves record pages', async () => {
  const { buildLightningAppNavigationPath } = await loadNavigationModule();

  const result = buildLightningAppNavigationPath('standard__Service', {
    pathname: '/lightning/r/Case/500xx0000012345/view',
  });

  assert.equal(
    result,
    '/lightning/app/standard__Service/r/Case/500xx0000012345/view'
  );
});

test('buildLightningAppNavigationPath preserves query string and hash', async () => {
  const { buildLightningAppNavigationPath } = await loadNavigationModule();

  const result = buildLightningAppNavigationPath('c__Ops', {
    pathname: '/lightning/page/home',
    search: '?one=1',
    hash: '#section',
  });

  assert.equal(result, '/lightning/app/c__Ops/page/home?one=1#section');
});

test('buildLightningAppNavigationPath falls back to app home for setup pages', async () => {
  const { buildLightningAppNavigationPath } = await loadNavigationModule();

  const result = buildLightningAppNavigationPath('c__Sales', {
    pathname: '/lightning/setup/ObjectManager/Account/Details/view',
    search: '?ignored=true',
  });

  assert.equal(result, '/lightning/app/c__Sales');
});

test('isPreservableLightningWorkspacePath rejects unsupported Lightning paths', async () => {
  const { isPreservableLightningWorkspacePath } = await loadNavigationModule();

  assert.equal(
    isPreservableLightningWorkspacePath('/lightning/setup/Home/home'),
    false
  );
  assert.equal(
    isPreservableLightningWorkspacePath('/lightning/app/c__Sales'),
    false
  );
});
