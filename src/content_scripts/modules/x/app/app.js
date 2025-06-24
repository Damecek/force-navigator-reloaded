import { LightningElement, track } from 'lwc';
import { register } from '../commandClassRegister/commandClassRegister';
import {
  Channel,
  CHANNEL_COMPLETED_AUTH_FLOW,
  CHANNEL_REFRESH_COMMANDS,
  CHANNEL_SEND_COMMANDS,
  CHANNEL_TOGGLE_COMMAND_PALETTE,
} from '../../../../shared';

/**
 * App component for the command palette.
 * Renders the palette UI and manages command subscriptions.
 *
 * @property {Array<Command>} commands - Commands available in the palette.
 * @property {boolean} isCommandPaletteVisible - Whether the palette is visible.
 */
export default class App extends LightningElement {
  static renderMode = 'light';
  @track commands = [];
  isCommandPaletteVisible = false;

  /**
   * Subscribe to background channels and set up event listeners.
   * No explicit cleanup required as the component remains for the page lifecycle.
   */
  connectedCallback() {
    new Channel(CHANNEL_SEND_COMMANDS).subscribe(this._handleCommands);
    new Channel(CHANNEL_TOGGLE_COMMAND_PALETTE).subscribe(
      this._handleToggleCommandPalette
    );
    new Channel(CHANNEL_COMPLETED_AUTH_FLOW).subscribe(this._handleAuth);
    window.addEventListener('keydown', this._handleEscape);
    this.publishRefreshCommands();
  }

  publishRefreshCommands() {
    return new Channel(CHANNEL_REFRESH_COMMANDS).publish();
  }

  _handleAuth = () => {
    console.log('auth completed');
    return this.publishRefreshCommands();
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

  // @todo: does not work on https://carvago--devas.sandbox.lightning.force.com/builder_platform_interaction/flowBuilder.app?flowId=301AP00000raYj2YAE
  _handleEscape = (event) => {
    if (event.key === 'Escape' || event.key === 'Esc') {
      this.isCommandPaletteVisible = false;
    }
  };

  /**
   * Handle close event from command palette
   */
  handleClose() {
    this.isCommandPaletteVisible = false;
  }
}
