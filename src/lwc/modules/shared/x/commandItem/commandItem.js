import { api, LightningElement } from 'lwc';
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
