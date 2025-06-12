import { createElement } from 'lwc';
/**
 * customElement is not supported in content scripts, so we need to use polyfill @webcomponents/custom-elements
 */
import '@webcomponents/custom-elements';
import App from 'x/app';

const elm = createElement('x-app', { is: App });
document.body.appendChild(elm);
