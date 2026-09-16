import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.__CLIENT_ID__ = 'test-client-id';

const { default: Channel } = await import('../src/shared/channel.js');

function installChrome(sendMessageImpl) {
  global.chrome = {
    runtime: { onMessage: { addListener() {}, removeListener() {} } },
    tabs: { sendMessage: sendMessageImpl },
  };
}

test('publish to a closed tab resolves instead of rejecting', async () => {
  installChrome(async () => {
    throw new Error('No tab with id: 42.');
  });
  await assert.doesNotReject(new Channel('x').publish({ data: 1, tabId: 42 }));
});

test('publish to a tab without a receiver resolves', async () => {
  installChrome(async () => {
    throw new Error(
      'Could not establish connection. Receiving end does not exist.'
    );
  });
  await assert.doesNotReject(new Channel('x').publish({ data: 1, tabId: 1 }));
});

test('publish rethrows unexpected tab errors', async () => {
  installChrome(async () => {
    throw new Error('Extension context invalidated.');
  });
  await assert.rejects(
    new Channel('x').publish({ data: 1, tabId: 1 }),
    /invalidated/
  );
});
