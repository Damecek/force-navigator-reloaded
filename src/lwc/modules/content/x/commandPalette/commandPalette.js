import { api, LightningElement, track } from 'lwc';
import uFuzzy from '@leeoniya/ufuzzy';
import VirtualScroller from '../../virtualScroller/virtualScroller';
import { Channel, CHANNEL_OPEN_POPUP } from '../../../../../shared';
import SearchRecordsCommand from '../commandClassRegister/SearchRecordsCommand';
import { filterCommandsBySearchTerm } from './searchMatching';

export default class CommandPalette extends LightningElement {
  static renderMode = 'light';

  /**
   * Fuzzy search engine instance
   */
  /* eslint-disable new-cap */
  uf = new uFuzzy({ intraMode: 1 });
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
  _isLoading = false;

  @api
  get commands() {
    return this._commands;
  }

  set commands(value) {
    this._commands = Array.isArray(value) ? value : [];
    this.filteredCommands = [...this._commands].sort(this.usageSort);
    console.log('CommandPalette commands set:', this.filteredCommands);
    this.selectedIndex = 0;
    this._visibleStart = 0;
    this._visibleEnd = 20;
  }

  @api
  get isLoading() {
    return this._isLoading;
  }

  set isLoading(value) {
    this._isLoading = Boolean(value);
    if (this._isLoading) {
      this._scroller = undefined;
    }
  }

  usageSort(a, b) {
    return (b.usage || 0) - (a.usage || 0);
  }

  get loadingIndicatorClass() {
    return `slds-button slds-button_icon slds-modal__close command-palette__loading-visibility${this._isLoading ? ' command-palette__loading-visibility_visible' : ''}`;
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
      this.focusInput();
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
    const searchModeTerm = this.getSearchModeTerm(searchTerm);

    if (searchModeTerm !== null) {
      this.filteredCommands = [this.createSearchDescriptor(searchModeTerm)];
      this.selectedIndex = 0;
      this._lastSearchTerm = searchTerm;
      return;
    }

    let currentHaystackSource;

    if (searchTerm) {
      currentHaystackSource = this.filteredCommands;
      this.filteredCommands = filterCommandsBySearchTerm({
        uf: this.uf,
        commands: this.commands,
        previousResults: currentHaystackSource,
        searchTerm,
        previousSearchTerm: this._lastSearchTerm,
      });
    } else {
      this.filteredCommands = [...this.commands];
    }
    this.filteredCommands.sort(this.usageSort);
    this.selectedIndex = 0;
    this._lastSearchTerm = searchTerm;
  }

  /**
   * Detect whether the current input should be treated as a search command.
   * @param {string} value
   * @returns {string|null}
   */
  getSearchModeTerm(value) {
    const normalizedValue = typeof value === 'string' ? value.trimStart() : '';
    if (!normalizedValue.startsWith('?')) {
      return null;
    }
    return normalizedValue.slice(1).trim();
  }

  /**
   * Build a transient descriptor for the search command.
   * @param {string} term
   * @returns {{ id: string, label: string, usage: number, className: string, createInstance: () => SearchRecordsCommand }}
   */
  createSearchDescriptor(term) {
    const labelSuffix = term ? ` > ${term}` : '';
    return {
      id: 'search-records',
      label: `Search${labelSuffix}`,
      usage: 0,
      className: 'SearchRecordsCommand',
      createInstance: () => new SearchRecordsCommand({ term }),
    };
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
   * Open the extension popup with shortcuts and settings.
   */
  handleHelp() {
    new Channel(CHANNEL_OPEN_POPUP).publish();
  }

  /**
   * Programmatically focus the search input.
   */
  @api
  focusInput() {
    const inp = this.refs.input;
    if (inp) {
      inp.focus();
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
    idx = ((idx % len) + len) % len;
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
