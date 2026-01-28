import { LightningElement, track } from 'lwc';
import { getMessage, UsageTracker } from '../../../../shared';

const labels = {
  commandUsageHeading: getMessage('optionsCommandUsageHeading'),
  errorLoadUsage: getMessage('errorLoadUsage'),
};

export default class JsonCommandUsage extends LightningElement {
  static renderMode = 'light';

  labels = labels;

  @track usageData = {};
  @track usageError = '';

  connectedCallback() {
    this.loadUsage();
  }

  async loadUsage() {
    try {
      const tracker = await UsageTracker.instance();
      const usageMap = await tracker.usageMap();
      this.usageData = this.cloneValue(usageMap) || {};
      this.usageError = '';
    } catch (err) {
      const message = err?.message || this.labels.errorLoadUsage;
      this.usageError = message;
      this.usageData = {};
    }
  }

  cloneValue(value) {
    if (value === null || value === undefined) {
      return value;
    }
    return JSON.parse(JSON.stringify(value));
  }
}
