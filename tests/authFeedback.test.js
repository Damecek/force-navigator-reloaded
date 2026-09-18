import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.__CLIENT_ID__ = 'test-client-id';

const {
  createAuthFeedback,
  buildAuthFailureToast,
  buildAuthSuccessToast,
  AUTH_HELP_LABEL,
  AUTH_SUCCESS_TITLE,
} = await import('../src/lwc/modules/content/x/authFeedback/authFeedback.js');

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
      armHelpLink: () => {
        calls.armed = (calls.armed || 0) + 1;
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

test('success toast is brief, native-first, and states the extension is ready', () => {
  const request = buildAuthSuccessToast();
  assert.equal(request.title, AUTH_SUCCESS_TITLE);
  assert.equal(request.variant, 'success');
  assert.equal(request.mode, 'dismissible');
  assert.ok(request.duration > 0);
  assert.match(request.message, /ready to use/);
});

test('success clears stale failure feedback and is shown once per attempt', () => {
  const { calls, deps } = createDeps();
  const feedback = createAuthFeedback(deps);
  feedback.showFailure(NOT_INSTALLED);
  assert.equal(feedback.showSuccess({ attemptId: 'attempt-9' }), 'scheduled');
  assert.equal(feedback.showSuccess({ attemptId: 'attempt-9' }), 'skipped');
  assert.equal(calls.toasts.length, 2);
  assert.equal(calls.toasts[1].variant, 'success');
  assert.deepEqual(calls.dismissed[0], [calls.toasts[0].title]);
  assert.equal(calls.fallbackDismissed, 2);
});

test('success without a previous notification shows the toast immediately', () => {
  const { calls, deps } = createDeps();
  const feedback = createAuthFeedback(deps);
  assert.equal(feedback.showSuccess({ attemptId: 'attempt-1' }), 'toast');
  assert.equal(calls.dismissed.length, 0);
});

test('success falls back to a timed status notice without the host toast', () => {
  const { calls, deps } = createDeps({ toastHandled: false });
  const feedback = createAuthFeedback(deps);
  assert.equal(feedback.showSuccess({ attemptId: 'attempt-1' }), 'fallback');
  assert.equal(calls.fallbacks[0].variant, 'success');
  assert.ok(calls.fallbacks[0].duration > 0);
});

test('a scheduled notification is dropped when a newer one was presented meanwhile', () => {
  const pending = [];
  const { calls, deps } = createDeps();
  deps.scheduleAfterDismiss = (callback) => pending.push(callback);
  let toastPresent = false;
  deps.showToast = (request) => {
    calls.toasts.push(request);
    toastPresent = true;
    return true;
  };
  deps.dismissToasts = (titles) => {
    calls.dismissed.push(titles);
    const had = toastPresent;
    toastPresent = false;
    return had;
  };
  const feedback = createAuthFeedback(deps);
  feedback.showFailure(NOT_INSTALLED);
  assert.equal(feedback.showFailure(CANCELLED), 'scheduled');
  assert.equal(feedback.showSuccess({ attemptId: 'attempt-3' }), 'toast');
  pending.forEach((callback) => callback());
  assert.equal(calls.toasts.length, 2);
  assert.equal(calls.toasts[1].variant, 'success');
});

test('arms the help link only when a native toast with the link is shown', () => {
  const { calls, deps } = createDeps();
  const feedback = createAuthFeedback(deps);
  feedback.showFailure(NOT_INSTALLED);
  assert.equal(calls.armed, 1);
  feedback.showSuccess({ attemptId: 'attempt-2' });
  assert.equal(calls.armed, 1);
  const fallback = createDeps({ toastHandled: false });
  createAuthFeedback(fallback.deps).showFailure(NOT_INSTALLED);
  assert.equal(fallback.calls.armed, undefined);
});
