import { api, LightningElement } from 'lwc';

/**
 * Reusable screenshot tile with image and caption.
 */
export default class WelcomeScreenshot extends LightningElement {
  static renderMode = 'light';

  @api alt = '';
  @api src = '';
  @api caption = '';
}
