import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { openAuthenticatedUrl } from '../src/services/browser.js';

test('openAuthenticatedUrl reports launcher failures without leaking its URL', async () => {
  const secretUrl = 'https://example.test/frontdoor?sid=secret';
  await assert.rejects(
    openAuthenticatedUrl(secretUrl, undefined, async () => {
      throw new Error(`failed to open ${secretUrl}`);
    }),
    (error) => {
      assert.equal(error.message, 'Unable to launch the browser.');
      assert.equal(error.message.includes(secretUrl), false);
      return true;
    }
  );
});

test('openAuthenticatedUrl detects an unsupported selected browser', async () => {
  const child = new EventEmitter();
  const promise = openAuthenticatedUrl(
    'https://example.test/frontdoor?sid=secret',
    'firefox',
    async () => {
      setImmediate(() => child.emit('close', 1));
      return child;
    }
  );
  await assert.rejects(promise, /Unable to launch the selected browser/);
});

test('openAuthenticatedUrl accepts a successfully spawned browser', async () => {
  const child = new EventEmitter();
  const promise = openAuthenticatedUrl(
    'https://example.test/frontdoor?sid=secret',
    'chrome',
    async () => {
      setImmediate(() => child.emit('close', 0));
      return child;
    }
  );
  await promise;
});

test('openAuthenticatedUrl handles a browser process that already exited', async () => {
  const exitedSuccessfully = new EventEmitter();
  exitedSuccessfully.exitCode = 0;
  await openAuthenticatedUrl(
    'https://example.test/frontdoor?sid=secret',
    undefined,
    async () => exitedSuccessfully
  );

  const exitedWithFailure = new EventEmitter();
  exitedWithFailure.exitCode = 1;
  await assert.rejects(
    openAuthenticatedUrl(
      'https://example.test/frontdoor?sid=secret',
      undefined,
      async () => exitedWithFailure
    ),
    /Unable to launch the selected browser/
  );
});
