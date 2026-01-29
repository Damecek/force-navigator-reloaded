import { createElement } from 'lwc';
/**
 * customElement is not supported in content scripts, so we need to use polyfill @webcomponents/custom-elements
 */
import '@webcomponents/custom-elements';
import { injectLightningNavigationBridge } from './lightningNavigationBridge';
import App from 'x/app';

/**
 * Inject the Lightning navigation bridge early so Aura navigation is available
 * before the command palette triggers navigation events.
 */
injectLightningNavigationBridge();

const elm = createElement('x-app', { is: App });
document.body.appendChild(elm);
