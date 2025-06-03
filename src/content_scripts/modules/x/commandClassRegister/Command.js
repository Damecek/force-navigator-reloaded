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
    this.pallet = document.querySelector('x-command-pallet');
  }

  /**
   * Execute the command's action.
   * @param {object} [options] - Optional parameters for execution (e.g., openInNewTab).
   * @returns {Promise<any>}
   */
  execute(options) {
    return Promise.reject(
      new Error('execute() must be implemented by subclass')
    );
  }
}
