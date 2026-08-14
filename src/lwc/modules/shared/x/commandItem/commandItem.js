import { api, LightningElement } from 'lwc';
import { getUsagePresentation } from './usagePresentation';
/**
 * @typedef {import('../commandClassRegister/commandFactory').CommandDescriptor} CommandDescriptor
 */

/**
 * Represents one command entry in the command palette list.
 */
export default class CommandItem extends LightningElement {
  static renderMode = 'light';
  /**
   * The command object to render
   * @type {CommandDescriptor|{ id: string, label: string, execute: Function }}
   */
  @api command;
  _commandInstance;

  /**
   * Whether this item is currently highlighted.
   * @type {boolean}
   */
  @api highlighted = false;

  /**
   * Whether positive command usage is displayed.
   * @type {boolean}
   */
  @api showUsage = false;

  /**
   * Usage content for visual and screen-reader presentation.
   * @returns {{ accessibleLabel: string, isVisible: boolean, text: string }}
   */
  get usagePresentation() {
    return getUsagePresentation(this.command, this.showUsage);
  }

  /**
   * Split the command label into plain and matched text for safe template rendering.
   * @returns {Array<{key: string, text: string, isMatch: boolean}>}
   */
  get labelSegments() {
    const label =
      typeof this.command?.label === 'string' ? this.command.label : '';
    const matchRanges = Array.isArray(this.command?.matchRanges)
      ? this.command.matchRanges
      : [];
    const segments = [];
    let cursor = 0;

    for (const range of matchRanges) {
      if (range && typeof range === 'object') {
        const start = Math.max(cursor, Number(range.start));
        const end = Math.min(label.length, Number(range.end));
        if (Number.isInteger(start) && Number.isInteger(end) && start < end) {
          if (cursor < start) {
            segments.push({ text: label.slice(cursor, start), isMatch: false });
          }
          segments.push({ text: label.slice(start, end), isMatch: true });
          cursor = end;
        }
      }
    }

    if (cursor < label.length || segments.length === 0) {
      segments.push({ text: label.slice(cursor), isMatch: false });
    }

    return segments.map((segment, index) => ({
      ...segment,
      key: `${segment.isMatch ? 'match' : 'text'}-${index}`,
    }));
  }

  /**
   * Computed class names for the item,
   * adding 'slds-has-focus' when command.isHighlighted is true.
   * @returns {Array<string|Object>} list of classes
   */
  get computedClassNames() {
    return [
      'slds-listbox__option slds-listbox__option_plain',
      { 'slds-has-focus': this.highlighted },
    ];
  }

  /**
   * Execute this command and close the palette when desired by the command.
   * @param {boolean} openInNewTab
   * @returns {Promise<void>}
   */
  @api async select(openInNewTab = false) {
    console.log('Executing command', this.command.id);
    const instance = this._getCommandInstance();
    if (!instance || typeof instance.execute !== 'function') {
      console.warn('Command instance missing execute function', this.command);
      return;
    }
    const shouldClose = await instance.execute({ openInNewTab });
    if (shouldClose !== false) {
      this.dispatchEvent(new CustomEvent('close', { bubbles: true }));
    }
  }

  /**
   * Handle click on this item: delegate to select()
   * @param {MouseEvent} event
   */
  async handleClick(event) {
    const openInNewTab = event.shiftKey || event.ctrlKey || event.metaKey;
    await this.select(openInNewTab);
  }

  _getCommandInstance() {
    if (!this._commandInstance) {
      if (this.command && typeof this.command.createInstance === 'function') {
        this._commandInstance = this.command.createInstance();
      } else {
        this._commandInstance = this.command;
      }
    }
    return this._commandInstance;
  }
}
