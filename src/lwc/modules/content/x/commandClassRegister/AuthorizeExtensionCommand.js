import Command from './Command';
import { Channel, CHANNEL_INVOKE_AUTH_FLOW } from '../../../../../shared';
import { publishCommandLoading } from '../loading/loadingEvents';

export default class AuthorizeExtensionCommand extends Command {
  /**
   * Initializes the authorization command with default id and label.
   */
  constructor({ usage } = {}) {
    super('AuthorizeExtensionCommand', 'Extension > Authorize', usage ?? 2);
  }

  /**
   * Executes the command by invoking interactive auth flow.
   * @returns {Promise<boolean>} whether the palette should close
   */
  async execute() {
    console.log('AuthorizeExtensionCommand.execute');
    publishCommandLoading(true);
    await new Channel(CHANNEL_INVOKE_AUTH_FLOW).publish({
      data: { hostname: this.hostname },
    });
    return false;
  }
}
