import {
  getCurrentTab,
  sendTabMessage,
} from '../src/background/chromeUtils.js';

describe('chromeUtils', () => {
  beforeEach(() => {
    global.chrome = {
      tabs: {
        query: jest.fn(async () => [{ id: 1 }]),
        sendMessage: jest.fn(),
      },
    };
  });

  afterEach(() => {
    delete global.chrome;
    jest.resetAllMocks();
  });

  test('getCurrentTab returns active tab', async () => {
    const tab = await getCurrentTab();
    expect(global.chrome.tabs.query).toHaveBeenCalledWith({
      active: true,
      currentWindow: true,
    });
    expect(tab).toEqual({ id: 1 });
  });

  test('sendTabMessage sends to provided tabId', async () => {
    await sendTabMessage({ foo: 'bar' }, 2);
    expect(global.chrome.tabs.sendMessage).toHaveBeenCalledWith(2, {
      foo: 'bar',
    });
  });

  test('sendTabMessage resolves current tab when id not supplied', async () => {
    await sendTabMessage({ baz: 42 });
    expect(global.chrome.tabs.query).toHaveBeenCalled();
    expect(global.chrome.tabs.sendMessage).toHaveBeenCalledWith(1, { baz: 42 });
  });
});
