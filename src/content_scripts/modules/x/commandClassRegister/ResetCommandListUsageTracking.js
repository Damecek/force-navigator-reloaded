import Command from './Command';
import {
  Channel,
  CHANNEL_REFRESH_COMMANDS,
  UsageTracker,
} from '../../../../shared';

/**
 * Command to reset command list usage tracking.
 */
export default class ResetCommandListUsageTracking extends Command {
  /**
   * Initializes the refresh command with default id and label.
   */
  constructor() {
    super(
      'ResetCommandListUsageTracking',
      'Extension > Reset Command List Usage Tracking',
      1
    );
  }

  /**
   * Executes the command: clears cache and dispatches refresh event.
   * @param {object} [options] Execution options (unused).
   * @returns {Promise<boolean>} whether the palette should close
   */
  async execute(options) {
    console.log('RefreshCommandListCommand.execute');
    await (await UsageTracker.instance()).resetUsage();
    await new Channel(CHANNEL_REFRESH_COMMANDS).publish();
    return false;
  }
}
