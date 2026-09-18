import { createElement } from 'lwc';
/**
 * customElement is not supported in content scripts, so we need to use polyfill @webcomponents/custom-elements
 */
import '@webcomponents/custom-elements';
import { injectLightningNavigationBridge } from './lightningNavigationBridge';
import { injectLightningToastBridge } from './lightningToastBridge';
import { registerAuthHelpLinkListener } from './authHelpLink';
import App from 'x/app';

/**
 * Inject the Lightning bridges early so Aura navigation and native toasts are
 * available before the command palette needs them.
 */
injectLightningNavigationBridge();
injectLightningToastBridge();
registerAuthHelpLinkListener();

const elm = createElement('x-app', { is: App });
document.body.appendChild(elm);
