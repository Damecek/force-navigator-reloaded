import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.__CLIENT_ID__ = 'test-client-id';

const ORIGIN_TAB = {
  id: 1,
  windowId: 10,
  url: 'https://acme.sandbox.lightning.force.com/lightning/page/home',
};
const AUTH_WINDOW_SENDER = {
  url: 'https://acme.sandbox.my.salesforce.com/setup/secur/RemoteAccessErrorPage.apexp?error=invalid_client',
  frameId: 0,
};
const ERROR_TAB = {
  id: 42,
  windowId: 11,
  url: 'https://acme.sandbox.my.salesforce.com/setup/secur/RemoteAccessErrorPage.apexp?error=invalid_client',
};

function installChromeMock() {
  const listeners = [];
  const sent = [];
  global.chrome = {
    runtime: {
      onMessage: {
        addListener: (fn) => listeners.push(fn),
        removeListener: () => {},
      },
      sendMessage: async (payload) => {
        sent.push({ payload });
      },
    },
    tabs: {
      query: async () => [{ id: 1 }, { id: 2 }],
      sendMessage: async (tabId, payload) => {
        sent.push({ tabId, payload });
      },
    },
  };
  return {
    sent,
    async dispatch(action, data, sender) {
      const responses = [];
      await Promise.all(
        listeners.map(async (fn) => {
          let responded;
          const pending = new Promise((resolve) => (responded = resolve));
          const result = fn({ action, data }, sender, (value) =>
            responded(value)
          );
          if (result === true) {
            responses.push(await pending);
          } else {
            await result;
          }
        })
      );
      return responses;
    },
  };
}

async function loadController() {
  return import(
    `../src/background/auth/authFlowController.js?test=${Date.now()}-${Math.random()}`
  );
}

test('publishes the specific Salesforce cause when the OAuth window is closed after the error page', async () => {
  const mock = installChromeMock();
  const { registerAuthFlowListeners } = await loadController();
  const attributed = [];
  let rejectLogin;
  registerAuthFlowListeners({
    login: () => new Promise((_, reject) => (rejectLogin = reject)),
    onErrorPageAttributed: (attempt, failure, tabId) =>
      attributed.push({ attempt, failure, tabId }),
  });

  const flow = mock.dispatch('invokeAuthFlow', undefined, { tab: ORIGIN_TAB });
  await new Promise((r) => setTimeout(r, 0));
  const responses = await mock.dispatch(
    'reportOauthErrorPage',
    {
      error: 'invalid_client',
      errorDescription: 'app must be installed into org',
      state: null,
    },
    AUTH_WINDOW_SENDER
  );
  assert.equal(attributed.length, 1);
  assert.equal(attributed[0].failure.kind, 'app_not_installed');
  assert.equal(attributed[0].tabId, null);
  assert.equal(responses[0].kind, 'app_not_installed');
  assert.equal(responses[0].confirmed, true);

  rejectLogin(
    Object.assign(new Error('The user did not approve access.'), {
      source: 'identity_api',
    })
  );
  await flow;

  const failed = mock.sent.find((m) => m.payload.action === 'failedAuthFlow');
  assert.ok(failed);
  assert.equal(failed.tabId, 1);
  assert.equal(failed.payload.data.failure.kind, 'app_not_installed');
  assert.equal(failed.payload.data.failure.confirmed, true);
  assert.equal(
    failed.payload.data.failure.orgHostname,
    'acme.sandbox.my.salesforce.com'
  );
  assert.equal(
    failed.payload.data.failure.salesforceError.error,
    'invalid_client'
  );
});

test('ignores an OAuth error page that does not belong to an active attempt', async () => {
  const mock = installChromeMock();
  const { registerAuthFlowListeners } = await loadController();
  const attributed = [];
  const { registry } = registerAuthFlowListeners({
    login: async () => ({}),
    onErrorPageAttributed: (...args) => attributed.push(args),
  });
  const responses = await mock.dispatch(
    'reportOauthErrorPage',
    {
      error: 'invalid_client',
      errorDescription: 'app must be installed into org',
    },
    { tab: ERROR_TAB }
  );
  assert.equal(attributed.length, 0);
  assert.equal(responses[0], null);
  assert.equal(
    registry.findForErrorReport({
      hostname: 'acme.sandbox.my.salesforce.com',
      tabId: 42,
    }),
    null
  );
});

test('reports cancellation as unconfirmed when no cause was detected', async () => {
  const mock = installChromeMock();
  const { registerAuthFlowListeners } = await loadController();
  registerAuthFlowListeners({
    login: async () => {
      throw Object.assign(new Error('The user did not approve access.'), {
        source: 'identity_api',
      });
    },
  });
  await mock.dispatch('invokeAuthFlow', undefined, { tab: ORIGIN_TAB });
  const failed = mock.sent.find((m) => m.payload.action === 'failedAuthFlow');
  assert.equal(failed.payload.data.failure.kind, 'cancelled');
  assert.equal(failed.payload.data.failure.confirmed, false);
  assert.equal(failed.payload.data.failure.salesforceError, null);
});

test('publishes completion with the attempt id and clears the attempt', async () => {
  const mock = installChromeMock();
  const { registerAuthFlowListeners } = await loadController();
  let receivedState;
  const { registry } = registerAuthFlowListeners({
    login: async (hostname, { state }) => {
      receivedState = state;
      return {};
    },
  });
  await mock.dispatch('invokeAuthFlow', undefined, { tab: ORIGIN_TAB });
  const completed = mock.sent.find(
    (m) => m.payload.action === 'completedAuthFlow'
  );
  assert.equal(completed.tabId, 1);
  assert.equal(completed.payload.data.attemptId, receivedState);
  assert.equal(registry.isActive(receivedState), false);
});

test('surfaces callback errors returned to the redirect URL as confirmed failures', async () => {
  const mock = installChromeMock();
  const { registerAuthFlowListeners } = await loadController();
  registerAuthFlowListeners({
    login: async () => {
      throw Object.assign(new Error('OAuth2 login failed: access_denied'), {
        source: 'oauth_callback',
        error: 'access_denied',
        errorDescription: 'end-user denied authorization',
      });
    },
  });
  await mock.dispatch('invokeAuthFlow', undefined, { tab: ORIGIN_TAB });
  const failed = mock.sent.find((m) => m.payload.action === 'failedAuthFlow');
  assert.equal(failed.payload.data.failure.kind, 'access_denied');
  assert.equal(failed.payload.data.failure.source, 'oauth_callback');
});

test('notifies the originating tab as soon as the error page is attributed, before the flow settles', async () => {
  const mock = installChromeMock();
  const { registerAuthFlowListeners } = await loadController();
  let rejectLogin;
  registerAuthFlowListeners({
    login: () => new Promise((_, reject) => (rejectLogin = reject)),
  });
  const flow = mock.dispatch('invokeAuthFlow', undefined, { tab: ORIGIN_TAB });
  await new Promise((r) => setTimeout(r, 0));
  await mock.dispatch(
    'reportOauthErrorPage',
    {
      error: 'invalid_client',
      errorDescription: 'app must be installed into org',
    },
    AUTH_WINDOW_SENDER
  );
  const early = mock.sent.filter((m) => m.payload.action === 'failedAuthFlow');
  assert.equal(early.length, 1);
  assert.equal(early[0].tabId, 1);
  assert.equal(early[0].payload.data.failure.kind, 'app_not_installed');

  rejectLogin(
    Object.assign(new Error('The user did not approve access.'), {
      source: 'identity_api',
    })
  );
  await flow;
  const all = mock.sent.filter((m) => m.payload.action === 'failedAuthFlow');
  assert.equal(all.length, 2);
  assert.equal(
    all[1].payload.data.failure.attemptId,
    all[0].payload.data.failure.attemptId
  );
  assert.equal(all[1].payload.data.failure.kind, 'app_not_installed');
});

test('attributes an error page from a new tab in another window and rejects one in the originating window', async () => {
  const mock = installChromeMock();
  const { registerAuthFlowListeners } = await loadController();
  const attributed = [];
  registerAuthFlowListeners({
    login: () => new Promise(() => {}),
    onErrorPageAttributed: (attempt, failure, tabId) => attributed.push(tabId),
  });
  mock.dispatch('invokeAuthFlow', undefined, { tab: ORIGIN_TAB });
  await new Promise((r) => setTimeout(r, 0));
  const sameWindow = await mock.dispatch(
    'reportOauthErrorPage',
    {
      error: 'invalid_client',
      errorDescription: 'app must be installed into org',
    },
    { tab: { ...ERROR_TAB, id: 43, windowId: ORIGIN_TAB.windowId } }
  );
  assert.equal(sameWindow[0], null);
  const otherWindow = await mock.dispatch(
    'reportOauthErrorPage',
    {
      error: 'invalid_client',
      errorDescription: 'app must be installed into org',
    },
    { tab: ERROR_TAB }
  );
  assert.equal(otherWindow[0].kind, 'app_not_installed');
  assert.deepEqual(attributed, [42]);
});

test('a reloaded error window receives the same failure again', async () => {
  const mock = installChromeMock();
  const { registerAuthFlowListeners } = await loadController();
  registerAuthFlowListeners({ login: () => new Promise(() => {}) });
  mock.dispatch('invokeAuthFlow', undefined, { tab: ORIGIN_TAB });
  await new Promise((r) => setTimeout(r, 0));
  const report = {
    error: 'invalid_client',
    errorDescription: 'app must be installed into org',
  };
  const first = await mock.dispatch(
    'reportOauthErrorPage',
    report,
    AUTH_WINDOW_SENDER
  );
  const second = await mock.dispatch(
    'reportOauthErrorPage',
    report,
    AUTH_WINDOW_SENDER
  );
  assert.equal(first[0].kind, 'app_not_installed');
  assert.equal(second[0].kind, 'app_not_installed');
  assert.equal(second[0].attemptId, first[0].attemptId);
});
