import { LightningElement, track } from 'lwc';
import { register } from '../commandClassRegister/commandClassRegister';
import {
  Channel,
  CHANNEL_COMPLETED_AUTH_FLOW,
  CHANNEL_GET_COMMANDS,
  CHANNEL_SEND_COMMANDS,
  CHANNEL_TOGGLE_COMMAND_PALETTE,
} from '../../../../shared';

/**
 * App component for the command palette.
 * It is responsible for rendering the command palette and handling the commands.
 *
 * @property {Array<Command>} commands - Array of commands to be rendered in the command palette.
 * @property {boolean} isCommandPaletteVisible - Flag to indicate whether the command palette is visible or not.
 * @property {Channel} sendCommandsChannel - Channel to send commands to the background script.
 * @property {Channel} toggleCommandPaletChannel - Channel to toggle the visibility of the command palette.
 * @property {Channel} authChannel - Channel to handle the authentication flow.
 */
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
