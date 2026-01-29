import { createElement } from 'lwc';
/**
 * customElement is not supported in content scripts, so we need to use polyfill @webcomponents/custom-elements
 */
import '@webcomponents/custom-elements';
import { injectLightningNavigationBridge } from './lightningNavigationBridge';
import App from 'x/app';

injectLightningNavigationBridge();

const elm = createElement('x-app', { is: App });
document.body.appendChild(elm);
