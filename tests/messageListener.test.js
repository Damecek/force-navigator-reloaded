import { handleMessage } from '../src/background/listeners/messageListener.js';
import { getCommands } from '../src/background/commandRegister.js';
import { interactiveLogin } from '../src/background/auth/auth.js';

jest.mock('../src/background/commandRegister.js');
jest.mock('../src/background/auth/auth.js');

describe('messageListener.handleMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.chrome = { tabs: { sendMessage: jest.fn() } };
  });

  afterEach(() => {
    delete global.chrome;
  });

  test('dispatches commands to sender tab', async () => {
    getCommands.mockResolvedValue({ foo: 'bar' });
    const sender = { tab: { id: 1, url: 'https://org.lightning.force.com' } };
    const handled = handleMessage({ action: 'getCommands' }, sender, jest.fn());
    await new Promise(setImmediate);
    expect(handled).toBe(false);
    expect(global.chrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
      action: 'sendCommands',
      data: { commands: { foo: 'bar' } },
    });
  });

  test('invokes auth flow and responds', async () => {
    interactiveLogin.mockResolvedValue({});
    const sendResponse = jest.fn();
    const sender = { tab: { id: 1, url: 'https://org.lightning.force.com' } };
    const handled = handleMessage(
      { action: 'invokeAuthFlow' },
      sender,
      sendResponse
    );
    await new Promise(setImmediate);
    expect(handled).toBe(true);
    expect(interactiveLogin).toHaveBeenCalledWith('org.lightning.force.com');
    expect(sendResponse).toHaveBeenCalledWith({});
  });

  test('unknown action returns false', () => {
    const result = handleMessage({ action: 'unknown' }, { tab: {} }, jest.fn());
    expect(result).toBe(false);
    expect(global.chrome.tabs.sendMessage).not.toHaveBeenCalled();
  });

  test('handleMessage handles error', () => {
    const sendResponse = jest.fn();
    const sender = { tab: { id: 1, url: 'https://org.lightning.force.com' } };
    console.error = jest.fn();
    handleMessage(undefined, sender, sendResponse);
    expect(sendResponse).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });
});
