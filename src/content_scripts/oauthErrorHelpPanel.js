import {
  AUTH_HELP_README_URL,
  EXTENSION_DISPLAY_NAME,
  describeAuthFailure,
} from '../shared/index.js';

export const OAUTH_ERROR_HELP_PANEL_ID = 'force-navigator-auth-help';

const PANEL_STYLES = `
  :host { all: initial; display: block; }
  .panel {
    box-sizing: border-box;
    margin: 16px auto;
    max-width: 720px;
    padding: 16px 20px;
    border: 1px solid #c9c7c5;
    border-left: 6px solid #ba0517;
    border-radius: 8px;
    background: #ffffff;
    color: #181818;
    font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
  }
  .eyebrow { margin: 0 0 4px; font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; color: #5c5c5c; }
  h2 { margin: 0 0 8px; font-size: 18px; line-height: 1.3; }
  h2:focus { outline: 3px solid #0176d3; outline-offset: 2px; }
  p { margin: 0 0 10px; }
  .admin { padding: 10px 12px; border-radius: 6px; background: #f3f3f3; }
  .actions { display: flex; flex-wrap: wrap; gap: 12px 16px; align-items: center; margin-top: 12px; }
  a.help {
    display: inline-block;
    padding: 8px 14px;
    border-radius: 6px;
    background: #0176d3;
    color: #ffffff;
    font-weight: 600;
    text-decoration: none;
  }
  a.help:hover { background: #014486; }
  a.help:focus-visible { outline: 3px solid #032d60; outline-offset: 2px; }
  .original { font-size: 12px; color: #444444; }
  .original code { font-family: Menlo, Consolas, monospace; }
  .close-hint { font-size: 12px; color: #5c5c5c; margin: 0; }
`;

/**
 * Render an extension-owned explanation above the Salesforce OAuth error.
 * The original Salesforce page stays untouched below the panel.
 * @param {Object} params
 * @param {import('../background/auth/authFlowController.js').AuthFailurePayload} params.failure
 * @param {Document} [params.documentRef]
 * @param {() => Promise<boolean>|boolean} [params.onOpenHelp] Opens the help page; resolve true when handled.
 * @returns {HTMLElement|null} The panel host element, or null when the failure is not confirmed.
 */
export function renderOauthErrorHelpPanel({
  failure,
  documentRef = document,
  onOpenHelp,
}) {
  if (!failure?.confirmed) {
    return null;
  }
  const existing = documentRef.getElementById(OAUTH_ERROR_HELP_PANEL_ID);
  if (existing) {
    existing.remove();
  }
  const copy = describeAuthFailure(failure);
  const host = documentRef.createElement('div');
  host.id = OAUTH_ERROR_HELP_PANEL_ID;
  host.setAttribute('data-force-navigator-failure-kind', failure.kind);
  const root = host.attachShadow({ mode: 'open' });

  const style = documentRef.createElement('style');
  style.textContent = PANEL_STYLES;
  root.appendChild(style);

  const panel = documentRef.createElement('section');
  panel.className = 'panel';
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-labelledby', 'force-navigator-auth-help-title');

  const eyebrow = documentRef.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = `${EXTENSION_DISPLAY_NAME} extension`;
  panel.appendChild(eyebrow);

  const heading = documentRef.createElement('h2');
  heading.id = 'force-navigator-auth-help-title';
  heading.tabIndex = -1;
  heading.textContent = copy.title;
  panel.appendChild(heading);

  const message = documentRef.createElement('p');
  message.textContent = copy.message;
  panel.appendChild(message);

  if (copy.adminSteps) {
    const admin = documentRef.createElement('p');
    admin.className = 'admin';
    admin.textContent = copy.adminSteps;
    panel.appendChild(admin);
  }

  const actions = documentRef.createElement('div');
  actions.className = 'actions';
  const help = documentRef.createElement('a');
  help.className = 'help';
  help.href = AUTH_HELP_README_URL;
  help.target = '_blank';
  help.rel = 'noopener noreferrer';
  help.textContent = 'Open authorization help';
  help.addEventListener('click', (event) => {
    if (typeof onOpenHelp !== 'function') {
      return;
    }
    event.preventDefault();
    Promise.resolve(onOpenHelp())
      .then((handled) => {
        if (!handled) {
          window.open(AUTH_HELP_README_URL, '_blank', 'noopener');
        }
      })
      .catch(() => window.open(AUTH_HELP_README_URL, '_blank', 'noopener'));
  });
  actions.appendChild(help);
  const closeHint = documentRef.createElement('p');
  closeHint.className = 'close-hint';
  closeHint.textContent = 'You can close this window.';
  actions.appendChild(closeHint);
  panel.appendChild(actions);

  if (copy.originalError) {
    const original = documentRef.createElement('p');
    original.className = 'original';
    original.append('Salesforce reported: ');
    const code = documentRef.createElement('code');
    code.textContent = copy.originalError;
    original.appendChild(code);
    panel.appendChild(original);
  }

  root.appendChild(panel);
  documentRef.body.prepend(host);
  heading.focus({ preventScroll: true });
  documentRef.defaultView?.scrollTo(0, 0);
  return host;
}
