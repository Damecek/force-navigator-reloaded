import Command from './Command';
import {
  Channel,
  CHANNEL_OPEN_REVIEW_PAGE,
  CHANNEL_REFRESH_COMMANDS,
  loadSettings,
  REVIEW_COMMAND_ENABLED_SETTINGS_KEY,
  REVIEW_COMMAND_SETTINGS_KEY,
  saveSettings,
} from '../../../../../shared';

/**
 * Command that opens the Chrome Web Store review page and disables itself.
 */
export default class ReviewCommand extends Command {
  constructor({ usage } = {}) {
    super(
      'ReviewCommand',
      'Extension > Review Force Navigator Reloaded',
      usage ?? 20
    );
  }

  /**
   * Open the review page and disable future review prompts.
   * @returns {Promise<boolean>} whether the palette should close
   */
  async execute() {
    await this.incrementUsage();
    const settings = await loadSettings();
    await saveSettings({
      ...settings,
      [REVIEW_COMMAND_SETTINGS_KEY]: {
        ...(settings[REVIEW_COMMAND_SETTINGS_KEY] || {}),
        [REVIEW_COMMAND_ENABLED_SETTINGS_KEY]: false,
      },
    });
    await new Channel(CHANNEL_OPEN_REVIEW_PAGE).publish();
    await new Channel(CHANNEL_REFRESH_COMMANDS).publish();
    return true;
  }
}
