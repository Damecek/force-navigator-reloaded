import Command from './Command';
import { Channel, CHANNEL_LOGIN_AS_PRIVATE } from '../../../../../shared';

/**
 * Command that logs in as another user and returns back to the current path.
 */
export default class LoginAsCommand extends Command {
  /**
   * @param {string} id - Unique identifier for the command.
   * @param {string} label - Display text for the command.
   * @param {string} userId - Salesforce user id to impersonate.
   */
  constructor({ id, label, userId, usage } = {}) {
    super(id, label, usage);
    this.userId = userId;
  }

  /**
   * Delegates login-as flow to background to open it in private window.
   * @returns {Promise<boolean>} whether the palette should close
   */
  async execute() {
    await this.incrementUsage();
    const contextPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (!this.userId) {
      return true;
    }
    await new Channel(CHANNEL_LOGIN_AS_PRIVATE).publish({
      data: {
        userId: this.userId,
        contextPath,
      },
    });
    return true;
  }
}
