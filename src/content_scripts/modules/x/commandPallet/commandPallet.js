import { api, LightningElement, track } from 'lwc';
import uFuzzy from '@leeoniya/ufuzzy';
import VirtualScroller from '../../virtualScroller/virtualScroller';

export default class CommandPallet extends LightningElement {
  static renderMode = 'light';

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
  _lastSearchTerm = '';

  _itemHeight = 36;
  _scroller;
  @track _visibleStart = 0;
  @track _visibleEnd = 20;

  _commands = [];

  @api
  get commands() {
    return this._commands;
  }

  set commands(value) {
    this._commands = Array.isArray(value) ? value : [];
    this.filteredCommands = [...this._commands].sort(this.usageSort);
    console.log('CommandPallet commands set:', this.filteredCommands);
    this.selectedIndex = 0;
    this._visibleStart = 0;
    this._visibleEnd = 20;
  }

  usageSort(a, b) {
    return (b.usage || 0) - (a.usage || 0);
  }

  /**
   * Computed array of objects for rendering, including highlight flag
   * @returns {{ cmd: any, idx: number, isSelected: boolean }[]}
   */
  get items() {
    return this.filteredCommands
      .slice(this._visibleStart, this._visibleEnd)
      .map((cmd, idx) => {
        const realIdx = idx + this._visibleStart;
        return {
          cmd,
          idx: realIdx,
          style: `position:absolute;top:${realIdx * this._itemHeight}px;width:100%;`,
          isSelected: realIdx === this.selectedIndex,
        };
      });
  }

  renderedCallback() {
    if (!this._didFocus) {
      const inp = this.refs.input;
      inp?.focus();
      this._didFocus = true;
    }
    if (!this._scroller) {
      const container = this.refs.listbox;
      if (container) {
        const firstItem = container.querySelector('li[data-index]');
        if (firstItem) {
          this._itemHeight = firstItem.offsetHeight || this._itemHeight;
        }
        this._scroller = new VirtualScroller(container, this._itemHeight, 10);
      }
    }
    this._updateVisibleRange();
  }

  /**
   * Handle filtering of commands based on fuzzy search term.
   * Limits results to top 6 matches.
   * @param {InputEvent} event
   */
  handleInput(event) {
    const searchTerm = event.target.value;
    let currentHaystackSource;

    if (searchTerm) {
      if (
        searchTerm.startsWith(this._lastSearchTerm) &&
        this._lastSearchTerm !== ''
      ) {
        currentHaystackSource = this.filteredCommands;
      } else {
        currentHaystackSource = this.commands;
      }

      const currentSearchHaystack = currentHaystackSource.map((c) => c.label);

      const [idxs, info, order] = this.uf.search(
        currentSearchHaystack,
        searchTerm
      );

      let newFilteredCommands = [];
      if (order && info && Array.isArray(info.idx)) {
        newFilteredCommands = order.map(
          (pos) => currentHaystackSource[info.idx[pos]]
        );
      } else if (Array.isArray(idxs)) {
        newFilteredCommands = idxs.map((i) => currentHaystackSource[i]);
      }

      this.filteredCommands = newFilteredCommands;
    } else {
      this.filteredCommands = [...this.commands];
    }
    this.filteredCommands.sort(this.usageSort);
    this.selectedIndex = 0;
    this._lastSearchTerm = searchTerm;
  }

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

  handleClose() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true }));
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
    const container = this.refs.listbox;
    if (!container) {
      return;
    }
    const top = idx * this._itemHeight;
    const bottom = top + this._itemHeight;
    const viewTop = container.scrollTop;
    const viewBottom = viewTop + container.clientHeight;
    if (top < viewTop) {
      container.scrollTop = top;
    } else if (bottom > viewBottom) {
      container.scrollTop = bottom - container.clientHeight;
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

  handleScroll() {
    this._updateVisibleRange();
  }

  _updateVisibleRange() {
    if (!this._scroller) {
      return;
    }
    const [start, end] = this._scroller.getVisibleRange(
      this.filteredCommands.length
    );
    this._visibleStart = start;
    this._visibleEnd = end;
  }

  get listStyle() {
    const height = this.filteredCommands.length * this._itemHeight;
    return `height:${height}px;position:relative;`;
  }
}
