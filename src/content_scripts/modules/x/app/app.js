import { LightningElement, track } from 'lwc';
import { register } from '../commandClassRegister/commandClassRegister';
import {
  CHANNEL_GET_COMMANDS,
  CHANNEL_SEND_COMMANDS,
  CHANNEL_TOGGLE_COMMAND_PALETTE,
} from '../../../../shared';

export default class App extends LightningElement {
  static renderMode = 'light';
  @track commands = [];
  isCommandPaletteVisible = false;

  connectedCallback() {
    this.loadCommands();
    chrome.runtime.onMessage.addListener(this._handleCommands);
    chrome.runtime.onMessage.addListener(this._handleToggleCommandPalette);
  }

  disconnectedCallback() {
    chrome.runtime.onMessage.removeListener(this._handleCommands);
    chrome.runtime.onMessage.removeListener(this._handleToggleCommandPalette);
  }

  _handleCommands = (request, sender, sendResponse) => {
    if (request.action !== CHANNEL_SEND_COMMANDS) {
      return;
    }
    console.log('handle commands', request);
    if (request?.data?.commands) {
      this.commands = Object.entries(request.data.commands)
        .flatMap(([className, rawArray]) =>
          rawArray.map((raw) => new register[className](raw))
        )
        .sort((a, b) => a.label.localeCompare(b.label));
    }
    return false;
  };

  _handleToggleCommandPalette = (request, sender, sendResponse) => {
    if (request.action !== CHANNEL_TOGGLE_COMMAND_PALETTE) {
      return;
    }
    console.log('toggle command palette');
    this.isCommandPaletteVisible = !this.isCommandPaletteVisible;
    return false;
  };

  async loadCommands() {
    await chrome.runtime.sendMessage({
      action: CHANNEL_GET_COMMANDS,
    });
  }

  /**
   * Handle close event from command palette
   */
  handleClose() {
    this.isCommandPaletteVisible = false;
  }
}
