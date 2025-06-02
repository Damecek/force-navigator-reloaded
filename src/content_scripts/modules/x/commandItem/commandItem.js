import { api, LightningElement } from 'lwc';

/**
 * Represents one command entry in the command palette list.
 */
export default class CommandItem extends LightningElement {
  static renderMode = 'light';
  /**
   * The command object to render
   * @type {{ id: string, label: string, execute: Function }}
   */
  @api command;

  /**
   * Whether this item is currently highlighted.
   * @type {boolean}
   */
  @api highlighted = false;

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
   * Execute this command and close the palette.
   * @param {boolean} openInNewTab
   */
  @api async select(openInNewTab = false) {
    await this.command.execute({ openInNewTab });
    this.dispatchEvent(new CustomEvent('close', { bubbles: true }));
  }

  /**
   * Handle click on this item: delegate to select()
   * @param {MouseEvent} event
   */
  async handleClick(event) {
    const openInNewTab = event.shiftKey || event.ctrlKey || event.metaKey;
    await this.select(openInNewTab);
  }
}
