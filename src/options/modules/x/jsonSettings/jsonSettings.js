import { LightningElement, track } from 'lwc';
import { loadSettings, resetSettings, saveSettings } from '../../../../shared';
import { basicSetup, EditorView } from 'codemirror';
import { json } from '@codemirror/lang-json';

export default class JsonSettings extends LightningElement {
  static renderMode = 'light';
  view;
  @track error = '';

  async renderedCallback() {
    if (!this.view) {
      const settings = await loadSettings();
      const parent = this.refs.editor;
      this.view = new EditorView({
        doc: JSON.stringify(settings, null, 2),
        extensions: [basicSetup, json()],
        parent,
      });
    }
  }

  async handleSave() {
    try {
      const value = this.view.state.doc.toString();
      const parsed = JSON.parse(value);
      await saveSettings(parsed);
      this.error = '';
    } catch (err) {
      this.error = 'Invalid JSON';
    }
  }

  async handleReset() {
    const settings = await resetSettings();
    this.view.dispatch({
      changes: {
        from: 0,
        to: this.view.state.doc.length,
        insert: JSON.stringify(settings, null, 2),
      },
    });
    this.error = '';
  }
}
