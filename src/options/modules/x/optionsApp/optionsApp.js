import { LightningElement } from 'lwc';
import { getLabels } from '../../../../shared';

const labels = getLabels(['optionsTitle']);

/**
 * Root component for the options page.
 */
export default class OptionsApp extends LightningElement {
  static renderMode = 'light';

  labels = labels;
}
