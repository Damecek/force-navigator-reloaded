import { api, LightningElement } from 'lwc';

/**
 * Reusable callout card with title, description and slotted action.
 */
export default class WelcomeCallout extends LightningElement {
  static renderMode = 'light';

  @api title = '';
  @api description = '';
}
