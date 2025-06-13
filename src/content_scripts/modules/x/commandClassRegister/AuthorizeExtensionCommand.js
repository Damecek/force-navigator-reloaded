import Command from './Command';
import {
  CHANNEL_GET_COMMANDS,
  CHANNEL_INVOKE_AUTH_FLOW,
  Channel,
} from '../../../../shared';

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
    const authFlowChannel = new Channel(CHANNEL_INVOKE_AUTH_FLOW);
    await authFlowChannel.publish();
    const getCommandsChannel = new Channel(CHANNEL_GET_COMMANDS);
    await getCommandsChannel.publish();
  }
}
