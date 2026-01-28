import { LightningElement } from 'lwc';
import { getMessage } from '../../../../shared';

const labels = {
  optionsTitle: getMessage('optionsTitle'),
};

/**
 * Root component for the options page.
 */
export default class OptionsApp extends LightningElement {
  static renderMode = 'light';

  labels = labels;
}
