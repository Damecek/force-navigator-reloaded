import test from 'node:test';
import assert from 'node:assert/strict';
import { isLoginContextPage } from '../src/content_scripts/mySalesforceLoginDetection.js';

function createDocument(selectors) {
  const selectorSet = new Set(selectors);
  return {
    querySelector(selector) {
      return selector
        .split(',')
        .map((part) => part.trim())
        .some((part) => selectorSet.has(part))
        ? {}
        : null;
    },
  };
}

function createSessionStorage() {
  const records = new Map();
  return {
    getItem(key) {
      return records.get(key) ?? null;
    },
    setItem(key, value) {
      records.set(key, value);
    },
  };
}

function createLocation(overrides = {}) {
  return {
    hostname: 'carvago--uat.sandbox.my.salesforce.com',
    pathname: '/',
    search: '',
    ...overrides,
  };
}

test('detects username-first Salesforce login prompt without password input', () => {
  const result = isLoginContextPage({
    location: createLocation(),
    document: createDocument([
      'form#login_form',
      'input#username',
      'input#Login[type="submit"]',
    ]),
    sessionStorage: createSessionStorage(),
    now: () => 1000,
  });

  assert.equal(result, true);
});

test('detects legacy login prompt with username and password inputs', () => {
  const result = isLoginContextPage({
    location: createLocation(),
    document: createDocument(['input#username', 'input#password']),
    sessionStorage: createSessionStorage(),
    now: () => 1000,
  });

  assert.equal(result, true);
});

test('ignores username-only pages without Salesforce login form', () => {
  const result = isLoginContextPage({
    location: createLocation(),
    document: createDocument(['input#username']),
    sessionStorage: createSessionStorage(),
    now: () => 1000,
  });

  assert.equal(result, false);
});

test('ignores authenticated Lightning pages', () => {
  const result = isLoginContextPage({
    location: createLocation({ pathname: '/lightning/page/home' }),
    document: createDocument([
      'form#login_form',
      'input#username',
      'input#Login[type="submit"]',
    ]),
    sessionStorage: createSessionStorage(),
    now: () => 1000,
  });

  assert.equal(result, false);
});

test('throttles repeated auto-login attempts for the same URL', () => {
  const sessionStorage = createSessionStorage();
  const context = {
    location: createLocation(),
    document: createDocument([
      'form#login_form',
      'input#username',
      'input#Login[type="submit"]',
    ]),
    sessionStorage,
    now: () => 1000,
  };

  assert.equal(isLoginContextPage(context), true);
  assert.equal(isLoginContextPage(context), false);
});
