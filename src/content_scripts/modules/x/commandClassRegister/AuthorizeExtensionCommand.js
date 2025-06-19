import Command from './Command';
import { Channel, CHANNEL_INVOKE_AUTH_FLOW } from '../../../../shared';

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
    await new Channel(CHANNEL_INVOKE_AUTH_FLOW).publish();
    console.log('auth flow invoked');
  }
}
