import { LightningElement, track } from 'lwc';
import { UsageTracker } from '../../../../../shared';

export default class JsonCommandUsage extends LightningElement {
  static renderMode = 'light';

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
      const message = err?.message || 'Unable to load usage statistics';
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
