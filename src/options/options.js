import { createElement } from 'lwc';
import OptionsApp from 'x/optionsApp';

/**
 * Mount the options page LWC component once DOM is ready.
 * @returns {void}
 */
document.addEventListener('DOMContentLoaded', () => {
  const elm = createElement('x-options-app', { is: OptionsApp });
  document.body.appendChild(elm);
});
