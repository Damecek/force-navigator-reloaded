import { LightningElement, track } from 'lwc';
import { register } from '../commandClassRegister/commandClassRegister';
import {
  Channel,
  CHANNEL_COMPLETED_AUTH_FLOW,
  CHANNEL_GET_COMMANDS,
  CHANNEL_SEND_COMMANDS,
  CHANNEL_TOGGLE_COMMAND_PALETTE,
} from '../../../../shared';

export default class App extends LightningElement {
  static renderMode = 'light';
  @track commands = [];
  isCommandPaletteVisible = false;
  sendCommandsChannel;
  toggleCommandPaletChannel;
  authChannel;

  connectedCallback() {
    this.sendCommandsChannel = new Channel(CHANNEL_SEND_COMMANDS);
    this.toggleCommandPaletChannel = new Channel(
      CHANNEL_TOGGLE_COMMAND_PALETTE
    );
    this.authChannel = new Channel(CHANNEL_COMPLETED_AUTH_FLOW);

    this.sendCommandsChannel.subscribe(this._handleCommands);
    this.toggleCommandPaletChannel.subscribe(this._handleToggleCommandPalette);
    this.authChannel.subscribe(this._handleAuth);

    this.publishGetCommands();
  }

  publishGetCommands() {
    return new Channel(CHANNEL_GET_COMMANDS).publish();
  }

  // todo: needs disconnectedCallback? what are the use cases?
  disconnectedCallback() {
    console.log('x-app disconnected');
    this.sendCommandsChannel.unsubscribe(this._handleCommands);
    this.toggleCommandPaletChannel.unsubscribe(
      this._handleToggleCommandPalette
    );
    this.authChannel.unsubscribe(this._handleAuth);
  }

  _handleAuth = () => {
    console.log('auth completed');
    return this.publishGetCommands();
  };

  _handleCommands = ({ data }) => {
    console.log('handle commands', data);
    if (data) {
      this.commands = Object.entries(data)
        .flatMap(([className, rawArray]) =>
          rawArray.map((raw) => new register[className](raw))
        )
        .sort((a, b) => a.label.localeCompare(b.label));
    }
    return false;
  };

  _handleToggleCommandPalette = () => {
    console.log('toggle command palette');
    this.isCommandPaletteVisible = !this.isCommandPaletteVisible;
    return false;
  };

  /**
   * Handle close event from command palette
   */
  handleClose() {
    this.isCommandPaletteVisible = false;
  }
}
