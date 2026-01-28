import { LightningElement, track } from 'lwc';
import {
  getLabels,
  loadSettings,
  resetSettings,
  saveSettings,
} from '../../../../shared';

const labels = getLabels([
  'optionsSettingsHeading',
  'optionsResetDefaults',
  'optionsSave',
  'errorLoadSettings',
  'errorSaveSettings',
  'errorResetSettings',
  'errorInvalidJson',
]);

export default class JsonSettings extends LightningElement {
  static renderMode = 'light';

  labels = labels;

  @track data;
  @track error = '';

  connectedCallback() {
    this.loadData();
  }

  async loadData() {
    try {
      const settings = await loadSettings();
      this.data = this.cloneValue(settings);
      this.error = '';
    } catch (err) {
      const message = err?.message || this.labels.errorLoadSettings;
      this.error = message;
    }
  }

  async handleSave() {
    const editor = this.refs?.editor;
    if (!editor) {
      return;
    }

    try {
      const value = editor.getValue();
      const parsed = JSON.parse(value);
      await saveSettings(parsed);
      this.data = this.cloneValue(parsed);
      this.error = '';
    } catch (err) {
      if (err instanceof SyntaxError) {
        this.error = this.labels.errorInvalidJson;
        return;
      }
      const message = err?.message || this.labels.errorSaveSettings;
      this.error = message;
    }
  }

  async handleReset() {
    try {
      const settings = await resetSettings();
      this.data = this.cloneValue(settings);
      this.error = '';
    } catch (err) {
      const message = err?.message || this.labels.errorResetSettings;
      this.error = message;
    }
  }

  cloneValue(value) {
    if (value === null || value === undefined) {
      return value;
    }
    return JSON.parse(JSON.stringify(value));
  }
}
