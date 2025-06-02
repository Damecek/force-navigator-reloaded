import '@webcomponents/custom-elements';
import { createElement } from 'lwc';
import App from 'x/app';

/**
 * Initializes and mounts the LWC application to the document body.
 * @public
 * @returns {void}
 */
export function mountApp() {
  const elm = createElement('x-app', { is: App });
  document.body.appendChild(elm);
}
