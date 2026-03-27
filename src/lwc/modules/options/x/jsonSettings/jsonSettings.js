import { LightningElement, track } from 'lwc';
import {
  loadSettings,
  resetSettings,
  saveSettings,
} from '../../../../../shared';

export default class JsonSettings extends LightningElement {
  static renderMode = 'light';

  @track data;
  @track error = '';

  connectedCallback() {
    this._handleKeyDown = this._onKeyDown.bind(this);
    document.addEventListener('keydown', this._handleKeyDown);
    this.loadData();
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this._handleKeyDown);
  }

  _onKeyDown(event) {
    if ((event.metaKey || event.ctrlKey) && event.key === 's') {
      event.preventDefault();
      this.handleSave();
    }
  }

  async loadData() {
    try {
      const settings = await loadSettings();
      this.data = this.cloneValue(settings);
      this.error = '';
    } catch (err) {
      const message = err?.message || 'Unable to load settings';
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
        this.error = 'Invalid JSON';
        return;
      }
      const message = err?.message || 'Unable to save settings';
      this.error = message;
    }
  }

  async handleReset() {
    try {
      const settings = await resetSettings();
      this.data = this.cloneValue(settings);
      this.error = '';
    } catch (err) {
      const message = err?.message || 'Unable to reset settings';
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
