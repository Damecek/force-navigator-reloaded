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
    await chrome.runtime.sendMessage({
      action: 'getCommands',
    });
  }
}
