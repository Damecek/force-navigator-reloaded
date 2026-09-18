export const FALLBACK_NOTICE_ID = 'force-navigator-notice';

const STYLES = `
  :host { all: initial; position: fixed; top: 16px; left: 50%; transform: translateX(-50%); z-index: 10001; width: min(720px, calc(100vw - 32px)); }
  .notice { box-sizing: border-box; display: flex; gap: 12px; align-items: flex-start; padding: 12px 16px; border-radius: 8px; color: #ffffff; font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; box-shadow: 0 4px 12px rgba(0,0,0,0.25); }
  .notice.error { background: #ba0517; }
  .notice.success { background: #2e844a; }
  .notice.info { background: #0176d3; }
  .body { flex: 1; }
  .title { margin: 0 0 4px; font-weight: 700; }
  .message { margin: 0; }
  a { color: #ffffff; font-weight: 600; text-decoration: underline; }
  a:focus-visible, button:focus-visible { outline: 3px solid #ffffff; outline-offset: 2px; }
  button { flex: none; border: 0; background: transparent; color: #ffffff; font-size: 20px; line-height: 1; cursor: pointer; padding: 0 4px; }
`;

/**
 * Render a minimal accessible notice when the host toast mechanism is unavailable.
 * @param {Object} params
 * @param {string} params.title
 * @param {string} params.message
 * @param {'error'|'success'|'info'} [params.variant]
 * @param {string} [params.helpLabel]
 * @param {string} [params.helpUrl]
 * @param {(event: MouseEvent) => void} [params.onHelpClick]
 * @param {number} [params.duration] Auto-dismiss after milliseconds; sticky when omitted.
 * @param {Document} [params.documentRef]
 * @returns {HTMLElement}
 */
export function showFallbackNotice({
  title,
  message,
  variant = 'info',
  helpLabel,
  helpUrl,
  onHelpClick,
  duration,
  documentRef = document,
}) {
  dismissFallbackNotice(documentRef);
  const host = documentRef.createElement('div');
  host.id = FALLBACK_NOTICE_ID;
  host.setAttribute('data-variant', variant);
  const root = host.attachShadow({ mode: 'open' });
  const style = documentRef.createElement('style');
  style.textContent = STYLES;
  root.appendChild(style);

  const notice = documentRef.createElement('div');
  notice.className = `notice ${variant}`;
  notice.setAttribute('role', variant === 'error' ? 'alert' : 'status');
  const body = documentRef.createElement('div');
  body.className = 'body';
  const heading = documentRef.createElement('p');
  heading.className = 'title';
  const text = documentRef.createElement('p');
  text.className = 'message';
  body.append(heading, text);
  if (helpLabel && helpUrl) {
    text.append(' ');
    const link = documentRef.createElement('a');
    link.href = helpUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = helpLabel;
    if (typeof onHelpClick === 'function') {
      link.addEventListener('click', onHelpClick);
    }
    text.appendChild(link);
  }
  const close = documentRef.createElement('button');
  close.type = 'button';
  close.setAttribute('aria-label', 'Dismiss notification');
  close.textContent = '×';
  close.addEventListener('click', () => host.remove());
  notice.append(body, close);
  root.appendChild(notice);
  documentRef.body.appendChild(host);
  const fill = () => {
    heading.textContent = title;
    text.prepend(message);
  };
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(fill);
  } else {
    fill();
  }
  if (typeof duration === 'number' && duration > 0) {
    setTimeout(() => host.remove(), duration);
  }
  return host;
}

/**
 * Remove the fallback notice when present.
 * @param {Document} [documentRef]
 * @returns {void}
 */
export function dismissFallbackNotice(documentRef = document) {
  documentRef.getElementById(FALLBACK_NOTICE_ID)?.remove();
}
