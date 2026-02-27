import { createElement } from 'lwc';
import GuidedAuthApp from 'x/guidedAuthApp';

/**
 * Mount the guided auth page LWC component once DOM is ready.
 * @returns {void}
 */
document.addEventListener('DOMContentLoaded', () => {
  const elm = createElement('x-guided-auth-app', { is: GuidedAuthApp });
  document.body.appendChild(elm);
});
