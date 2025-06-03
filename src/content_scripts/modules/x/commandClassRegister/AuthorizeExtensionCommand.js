import Command from './Command';

export default class AuthorizeExtensionCommand extends Command {
  /**
   * Initializes the authorization command with default id and label.
   */
  constructor() {
    super('AuthorizeExtensionCommand', 'Authorize Extension');
  }

  /**
   * Executes the command: invokes auth flow,  calls refresh command list.
   * @param {object} [options] Execution options (unused).
   * @returns {Promise<void>}
   */
  async execute(options) {
    console.log('AuthorizeExtensionCommand.execute');
    await chrome.runtime.sendMessage({
      action: 'invokeAuthFlow',
    });
    if (this.pallet) {
      this.pallet.dispatchEvent(
        new CustomEvent('refreshcommands', { bubbles: true, composed: true })
      );
    }
  }
}
