import { createElement } from 'lwc';
import WelcomeApp from 'x/welcomeApp';

/**
 * Mount the welcome page LWC component once DOM is ready.
 * @returns {void}
 */
document.addEventListener('DOMContentLoaded', () => {
  const elm = createElement('x-welcome-app', { is: WelcomeApp });
  document.body.appendChild(elm);
});
