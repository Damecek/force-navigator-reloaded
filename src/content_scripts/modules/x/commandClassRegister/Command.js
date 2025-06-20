/**
 * Abstract base class for commands in the command palette.
 */
export default class Command {
  /**
   * @param {string} id - Unique identifier for the command.
   * @param {string} label - Display text for the command.
   */
  constructor(id, label) {
    this.id = id;
    this.label = label;
    this.hostname = window.location.hostname;
  }

  /**
   * Execute the command's action.
   *
   * @param {object} [options] - Optional parameters for execution (e.g., openInNewTab).
   * @returns {Promise<boolean>} whether the palette should close after executing
   */
  execute(options) {
    return Promise.reject(
      new Error('execute() must be implemented by subclass')
    );
  }
}
