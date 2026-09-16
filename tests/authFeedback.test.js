import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.__CLIENT_ID__ = 'test-client-id';

const { createAuthFeedback, buildAuthFailureToast, AUTH_HELP_LABEL } =
  await import('../src/lwc/modules/content/x/authFeedback/authFeedback.js');

const NOT_INSTALLED = {
  attemptId: 'attempt-1',
  kind: 'app_not_installed',
  confirmed: true,
  salesforceError: {
    error: 'invalid_client',
    description: 'app must be installed into org',
  },
};
const CANCELLED = {
  attemptId: 'attempt-2',
  kind: 'cancelled',
  confirmed: false,
  salesforceError: null,
};

function createDeps({ toastHandled = true } = {}) {
  const calls = {
    toasts: [],
    dismissed: [],
    fallbacks: [],
    fallbackDismissed: 0,
    help: 0,
  };
  return {
    calls,
    deps: {
      showToast: (request) => {
        calls.toasts.push(request);
        return toastHandled;
      },
      dismissToasts: (titles) => {
        calls.dismissed.push(titles);
        return true;
      },
      showFallback: (params) => {
        calls.fallbacks.push(params);
        return {};
      },
      dismissFallback: () => {
        calls.fallbackDismissed += 1;
      },
      openHelp: () => {
        calls.help += 1;
      },
      scheduleAfterDismiss: (callback) => {
        calls.scheduled = (calls.scheduled || 0) + 1;
        callback();
      },
    },
  };
}

test('failure toast is sticky, actionable, and carries the help link', () => {
  const request = buildAuthFailureToast(NOT_INSTALLED);
  assert.equal(request.variant, 'error');
  assert.equal(request.mode, 'sticky');
  assert.equal(request.helpLabel, AUTH_HELP_LABEL);
  assert.match(request.helpUrl, /^https:\/\/github\.com\//);
  assert.match(request.title, /installed in this Salesforce org/);
  assert.match(request.message, /Setup > Connected Apps OAuth Usage/);
});

test('cancellation toast does not assert missing installation', () => {
  const request = buildAuthFailureToast(CANCELLED);
  assert.equal(request.title, 'Authorization was not completed');
  assert.doesNotMatch(request.message, /needs to install/);
});

test('shows one notification per attempt and prefers the native toast', () => {
  const { calls, deps } = createDeps();
  const feedback = createAuthFeedback(deps);
  assert.equal(feedback.showFailure(NOT_INSTALLED), 'toast');
  assert.equal(feedback.showFailure(NOT_INSTALLED), 'skipped');
  assert.equal(calls.toasts.length, 1);
  assert.equal(calls.fallbacks.length, 0);
});

test('a new attempt dismisses the previous notification before showing the next', () => {
  const { calls, deps } = createDeps();
  const feedback = createAuthFeedback(deps);
  feedback.showFailure(NOT_INSTALLED);
  assert.equal(feedback.showFailure(CANCELLED), 'scheduled');
  assert.equal(calls.toasts.length, 2);
  assert.deepEqual(calls.dismissed[0], [calls.toasts[0].title]);
  assert.equal(calls.fallbackDismissed, 2);
  assert.equal(calls.scheduled, 1);
});

test('falls back to the accessible notice when the host toast is unavailable', () => {
  const { calls, deps } = createDeps({ toastHandled: false });
  const feedback = createAuthFeedback(deps);
  assert.equal(feedback.showFailure(NOT_INSTALLED), 'fallback');
  assert.equal(calls.fallbacks.length, 1);
  assert.equal(calls.fallbacks[0].variant, 'error');
  assert.equal(calls.fallbacks[0].duration, undefined);
  let prevented = false;
  calls.fallbacks[0].onHelpClick({
    preventDefault: () => {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
  assert.equal(calls.help, 1);
});
