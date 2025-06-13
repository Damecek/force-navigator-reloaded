import { LightningElement, track } from 'lwc';
import { register } from '../commandClassRegister/commandClassRegister';
import {
  CHANNEL_GET_COMMANDS,
  CHANNEL_SEND_COMMANDS,
  CHANNEL_TOGGLE_COMMAND_PALETTE,
  Channel,
} from '../../../../shared';

export default class App extends LightningElement {
  static renderMode = 'light';
  @track commands = [];
  isCommandPaletteVisible = false;
  getCommandsChannel = new Channel(CHANNEL_GET_COMMANDS);
  sendCommandsChannel = new Channel(CHANNEL_SEND_COMMANDS);
  toggleCommandPaletChannel = new Channel(CHANNEL_TOGGLE_COMMAND_PALETTE);

  connectedCallback() {
    this.loadCommands();
    this.sendCommandsChannel.subscribe(this._handleCommands);
    this.toggleCommandPaletChannel.subscribe(this._handleToggleCommandPalette);
  }

  disconnectedCallback() {
    this.sendCommandsChannel.unsubscribe(this._handleCommands);
    this.toggleCommandPaletChannel.unsubscribe(
      this._handleToggleCommandPalette
    );
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
    await this.getCommandsChannel.publish();
  }

  /**
   * Handle close event from command palette
   */
  handleClose() {
    this.isCommandPaletteVisible = false;
  }
}
