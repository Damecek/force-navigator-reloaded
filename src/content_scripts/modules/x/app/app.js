import { api, LightningElement, track } from 'lwc';
import { register } from '../commandClassRegister/commandClassRegister';

export default class App extends LightningElement {
  static renderMode = 'light';
  @track commands = [];
  isCommandPalletVisible = false;

  connectedCallback() {
    this.loadCommands();
    this.addEventListener('refreshcommands', this._handleRefreshCommands);
  }

  disconnectedCallback() {
    this.removeEventListener('refreshcommands', this._handleRefreshCommands);
  }

  _handleRefreshCommands = () => {
    this.loadCommands();
  };

  async loadCommands() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getCommands',
      });
      if (response && response.commands) {
        this.commands = Object.entries(response.commands)
          .flatMap(([className, rawArray]) =>
            rawArray.map((raw) => new register[className](raw))
          )
          .sort((a, b) => a.label.localeCompare(b.label));
      }
    } catch (error) {
      console.error('App: error loading commands:', error);
      this.commands = [];
    }
  }

  @api toggleCommandPallet() {
    this.isCommandPalletVisible = !this.isCommandPalletVisible;
  }

  /**
   * Handle close event from command palette
   */
  handleClose() {
    this.isCommandPalletVisible = false;
  }
}
