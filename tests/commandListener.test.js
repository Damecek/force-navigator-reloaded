import { handleCommand } from '../src/background/listeners/commandListener.js';
import { sendTabMessage } from '../src/background/chromeUtils.js';
import { isContentScriptAllowedDomain } from '../src/background/urlUtils.js';

jest.mock('../src/background/chromeUtils.js');
jest.mock('../src/background/urlUtils.js');

describe('commandListener.handleCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('ignores command when url not allowed', async () => {
    isContentScriptAllowedDomain.mockReturnValue(false);
    await handleCommand('toggle-command-palette', {
      url: 'https://example.com',
    });
    expect(sendTabMessage).not.toHaveBeenCalled();
  });

  test('handles toggle-command-palette', async () => {
    isContentScriptAllowedDomain.mockReturnValue(true);
    await handleCommand('toggle-command-palette', {
      id: 5,
      url: 'https://org.lightning.force.com',
    });
    expect(sendTabMessage).toHaveBeenCalledWith(
      { action: 'toggleCommandPalette' },
      5
    );
  });

  test('logs unknown command', async () => {
    isContentScriptAllowedDomain.mockReturnValue(true);
    console.error = jest.fn();
    await handleCommand('unknown', { url: 'https://org.lightning.force.com' });
    expect(console.error).toHaveBeenCalled();
    expect(sendTabMessage).not.toHaveBeenCalled();
  });
});
