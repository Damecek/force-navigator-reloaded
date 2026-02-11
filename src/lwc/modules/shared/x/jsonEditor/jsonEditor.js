import { api, LightningElement } from 'lwc';
import { basicSetup, EditorView } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { json } from '@codemirror/lang-json';

export default class JsonEditor extends LightningElement {
  static renderMode = 'light';

  view;
  _pendingDoc;
  _needsRecreate = false;

  _value;

  /**
   * The JSON value rendered by the editor. Mutations are reflected back to the
   * parent via getValue().
   * @type {unknown}
   */
  @api
  get value() {
    return this._value;
  }

  set value(nextValue) {
    const cloned = this.cloneValue(nextValue);
    this._value = cloned;
    const doc = this.toDocString(cloned);

    if (this.view) {
      this.updateDoc(doc);
    } else {
      this._pendingDoc = doc;
    }
  }

  _readOnly = false;

  /**
   * Controls whether the editor is read-only.
   * @type {boolean}
   */
  @api
  get readOnly() {
    return this._readOnly;
  }

  set readOnly(value) {
    const normalized = Boolean(value);
    if (normalized === this._readOnly) {
      return;
    }
    this._readOnly = normalized;
    if (this.view) {
      this._needsRecreate = true;
    }
  }

  renderedCallback() {
    if (this._needsRecreate) {
      this.destroyEditor();
      this._needsRecreate = false;
    }

    if (!this.view) {
      this.initEditor();
    }
  }

  disconnectedCallback() {
    this.destroyEditor();
  }

  /**
   * Returns the current editor document as a string.
   * @returns {string}
   */
  @api
  getValue() {
    if (this.view) {
      return this.view.state.doc.toString();
    }
    return this._pendingDoc ?? this.toDocString(this._value);
  }

  initEditor() {
    const parent = this.refs.editor;
    if (!parent) {
      return;
    }

    const doc = this._pendingDoc ?? this.toDocString(this._value);
    this.view = new EditorView({
      doc,
      extensions: this.buildExtensions(),
      parent,
    });
    this._pendingDoc = undefined;
  }

  destroyEditor() {
    if (this.view) {
      this.view.destroy();
      this.view = undefined;
    }
  }

  buildExtensions() {
    return [
      basicSetup,
      json(),
      EditorState.readOnly.of(this._readOnly),
      EditorView.editable.of(!this._readOnly),
    ];
  }

  updateDoc(doc) {
    if (!this.view) {
      return;
    }

    const current = this.view.state.doc.toString();
    if (current === doc) {
      return;
    }

    this.view.dispatch({
      changes: { from: 0, to: this.view.state.doc.length, insert: doc },
    });
  }

  cloneValue(value) {
    if (value === null || value === undefined) {
      return value;
    }
    return JSON.parse(JSON.stringify(value));
  }

  toDocString(value) {
    if (typeof value === 'string') {
      return value;
    }
    if (value === null || value === undefined) {
      return '';
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch (err) {
      return '';
    }
  }
}
