import { LightningElement, track } from 'lwc';
import { loadSettings, saveSettings, resetSettings } from '../../../../shared';
import { EditorView, basicSetup } from '@codemirror/basic-setup';
import { json } from '@codemirror/lang-json';

export default class JsonSettings extends LightningElement {
  editor;
  view;
  @track error = '';

  async connectedCallback() {
    const settings = await loadSettings();
    this.editorValue = JSON.stringify(settings, null, 2);
  }

  renderedCallback() {
    if (!this.view) {
      const parent = this.refs.editor;
      this.view = new EditorView({
        doc: this.editorValue,
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
