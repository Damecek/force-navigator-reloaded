import { api, LightningElement, track } from 'lwc';
import uFuzzy from '@leeoniya/ufuzzy';

export default class CommandPallet extends LightningElement {
  static renderMode = 'light';

  searchTerm = '';
  /**
   * Fuzzy search engine instance
   */
  /* eslint-disable new-cap */
  uf = new uFuzzy();
  @track filteredCommands = [];
  /**
   * Index of the currently highlighted command in filteredCommands
   */
  @track selectedIndex = 0;
  _didFocus = false;

  _commands = [];

  @api
  get commands() {
    return this._commands;
  }

  set commands(value) {
    this._commands = Array.isArray(value) ? value : [];
    this.filteredCommands = [...this._commands];
    this.selectedIndex = 0;
  }

  /**
   * Computed array of objects for rendering, including highlight flag
   * @returns {{ cmd: any, idx: number, isSelected: boolean }[]}
   */
  get items() {
    return this.filteredCommands.map((cmd, idx) => ({
      cmd,
      idx,
      isSelected: idx === this.selectedIndex,
    }));
  }

  connectedCallback() {
    window.addEventListener('keydown', this._handleKeyDown);
  }

  renderedCallback() {
    if (!this._didFocus) {
      const inp = this.refs.input;
      inp?.focus();
      this._didFocus = true;
    }
  }

  /**
   * Handle filtering of commands based on fuzzy search term.
   * Limits results to top 6 matches.
   * @param {InputEvent} event
   */
  handleInput(event) {
    const searchTerm = event.target.value;
    if (searchTerm) {
      const haystack = this.commands.map((c) => c.label);
      const [idxs, info, order] = this.uf.search(haystack, searchTerm);
      if (order && info && Array.isArray(info.idx)) {
        this.filteredCommands = order.map((pos) => {
          const cmdIndex = info.idx[pos];
          return this.commands[cmdIndex];
        });
      } else {
        this.filteredCommands = [];
      }
    } else {
      this.filteredCommands = [...this.commands];
    }
    this.selectedIndex = 0;
  }

  /**
   * Handle close action: dispatch close event
   */
  closePalette() {
    this.dispatchEvent(new CustomEvent('close'));
  }

  /**
   * Keydown handler for Escape key
   * @todo: this should be handled by the x-app component
   * @todo: does not work on https://carvago--devas.sandbox.lightning.force.com/builder_platform_interaction/flowBuilder.app?flowId=301AP00000raYj2YAE
   */
  _handleKeyDown = (event) => {
    if (event.key === 'Escape' || event.key === 'Esc') {
      this.closePalette();
    }
  };

  /**
   * Handle key navigation (arrows, enter) on the input field.
   * @param {KeyboardEvent} event
   */
  handleKeyDown(event) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.moveSelection(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.moveSelection(-1);
        break;
      case 'Enter':
        event.preventDefault();
        this.executeSelection(event.shiftKey, event.ctrlKey || event.metaKey);
        break;
      default:
        break;
    }
  }

  /**
   * Move the highlighted index by delta and scroll into view.
   * @param {number} delta
   */
  moveSelection(delta) {
    const len = this.filteredCommands.length;
    if (len === 0) {
      return;
    }
    let idx = this.selectedIndex + delta;
    idx = Math.max(0, Math.min(idx, len - 1));
    this.selectedIndex = idx;
    this._scrollIntoView(idx);
  }

  /**
   * Scroll the list item at index into view.
   * @param {number} idx
   */
  _scrollIntoView(idx) {
    const items = this.querySelectorAll('li[data-index]');
    const el = items[idx];
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
    }
  }

  /**
   * Execute the currently highlighted command.
   * @param {boolean} shiftKey
   * @param {boolean} ctrlKey
   */
  executeSelection(shiftKey, ctrlKey) {
    const openInNewTab = shiftKey || ctrlKey;
    const itemEl = this.querySelector(
      'x-command-item[data-highlighted="true"]'
    );
    if (itemEl && typeof itemEl.select === 'function') {
      itemEl.select(openInNewTab);
    }
  }

  /**
   * Handle mouse hover to update highlighted index.
   * @param {MouseEvent} event
   */
  handleMouseOver(event) {
    const idx = Number(event.currentTarget.dataset.index);
    if (!isNaN(idx)) {
      this.selectedIndex = idx;
    }
  }

  disconnectedCallback() {
    window.removeEventListener('keydown', this._handleKeyDown);
  }
}
