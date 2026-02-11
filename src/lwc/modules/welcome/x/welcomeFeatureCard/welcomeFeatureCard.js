import { api, LightningElement } from 'lwc';

/**
 * Reusable feature card used in the "What it can do" section.
 */
export default class WelcomeFeatureCard extends LightningElement {
  static renderMode = 'light';

  @api title = '';
  @api description = '';
}
