import { LightningElement, track } from 'lwc';
import { loadSettings, resetSettings, saveSettings } from '../../../../shared';
import { basicSetup, EditorView } from 'codemirror';
import { json } from '@codemirror/lang-json';

export default class JsonSettings extends LightningElement {
  static renderMode = 'light';
  view;
  @track error = '';

  /**
   * Initialize the CodeMirror editor once after the component renders.
   * @returns {Promise<void>}
   */
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

  /**
   * Persist the JSON settings entered in the editor.
   * Displays an error message when the JSON is invalid.
   * @returns {Promise<void>}
   */
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

  /**
   * Reset the editor contents to the default settings.
   * @returns {Promise<void>}
   */
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
