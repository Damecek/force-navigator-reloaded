import { api, LightningElement } from 'lwc';

/**
 * Reusable section wrapper for welcome page content.
 */
export default class WelcomeSection extends LightningElement {
  static renderMode = 'light';

  @api title = '';
}
