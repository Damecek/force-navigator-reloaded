import {
  buildFrontdoorUrl,
  CacheManager,
  Channel,
  CHANNEL_COMPLETED_AUTH_FLOW,
  CHANNEL_AUTOLOGIN_MYDOMAIN,
  CHANNEL_FAILED_AUTH_FLOW,
  CHANNEL_INVOKE_AUTH_FLOW,
  CHANNEL_OPEN_OPTIONS,
  CHANNEL_OPEN_POPUP,
  CHANNEL_REFRESH_COMMANDS,
  CHANNEL_SEND_COMMANDS,
  CHANNEL_TOGGLE_COMMAND_PALETTE,
  isContentScriptAllowedDomain,
  loadSettings,
} from '../shared';
import { getCommands } from './commandRegister';
import { ensureWebScopedToken, interactiveLogin } from './auth/auth';

chrome.commands.onCommand.addListener((command, tab) => {
  const url = tab?.url;
  if (!url || !isContentScriptAllowedDomain(url)) {
    console.log(`handleCommand: ignored command "${command}" on URL: ${url}`);
    return;
  }
  console.log('Received command:', command);
  switch (command) {
    case 'toggle-command-palette':
      return new Channel(CHANNEL_TOGGLE_COMMAND_PALETTE).publish({
        tabId: tab.id,
      });
    default:
      console.error('Unknown command:', command);
  }
});

/**
 * Sending commands back through different channel as the publisher of CHANNEL_REFRESH_COMMANDS does not need to be the handler of the commands.
 */
new Channel(CHANNEL_REFRESH_COMMANDS).subscribe(async ({ sender }) => {
  const hostname = getSenderHostname(sender);
  const commands = hostname ? await getCommands(hostname) : [];
  console.log('Commands to send:', commands);
  return new Channel(CHANNEL_SEND_COMMANDS).publish({
    data: commands,
    tabId: sender.tab.id,
  });
});

new Channel(CHANNEL_INVOKE_AUTH_FLOW).subscribe(async ({ sender }) => {
  const hostname = getSenderHostname(sender);
  try {
    await interactiveLogin(hostname);
    return new Channel(CHANNEL_COMPLETED_AUTH_FLOW).publish({
      tabId: sender.tab.id,
    });
  } catch (error) {
    console.error('Auth flow failed', error);
    return new Channel(CHANNEL_FAILED_AUTH_FLOW).publish({
      data: { message: error?.message || 'Auth flow failed' },
      tabId: sender.tab.id,
    });
  }
});

new Channel(CHANNEL_AUTOLOGIN_MYDOMAIN).subscribe(async ({ sender }) => {
  const tabId = sender?.tab?.id;
  const orgHostname = getSenderHostname(sender);
  const retURL = getSenderRetURL(sender) || '/lightning/page/home';
  console.log('MyDomain auto-login requested', {
    tabId,
    orgHostname,
    senderUrl: sender?.tab?.url,
    retURL,
  });
  try {
    if (typeof tabId !== 'number') {
      throw new Error('Missing sender tab id');
    }
    if (typeof orgHostname !== 'string' || !orgHostname) {
      throw new Error('Missing org hostname');
    }
    const token = await ensureWebScopedToken(orgHostname);
    if (!token?.access_token) {
      throw new Error(`No authorized token for ${orgHostname}`);
    }
    const url = buildFrontdoorUrl(orgHostname, token.access_token, retURL);
    console.log('MyDomain auto-login redirect', { orgHostname, url });
    await chrome.tabs.update(tabId, { url });
  } catch (error) {
    console.error('MyDomain auto-login failed', error, { tabId, orgHostname });
  }
});

new Channel(CHANNEL_OPEN_OPTIONS).subscribe(() => {
  if (chrome.runtime.openOptionsPage) {
    return chrome.runtime.openOptionsPage();
  } else {
    return console.warn('openOptionsPage is not supported');
  }
});

new Channel(CHANNEL_OPEN_POPUP).subscribe(() => {
  if (chrome.action?.openPopup) {
    return chrome.action.openPopup();
  } else {
    return console.warn('openPopup is not supported');
  }
});

/**
 * Safely extract the hostname from a runtime message sender.
 * @param {chrome.runtime.MessageSender} sender
 * @returns {string|null} Parsed hostname or null when unavailable.
 */
function getSenderHostname(sender) {
  try {
    return sender.tab && new URL(sender.tab.url).hostname;
  } catch {
    console.error('Failed to get sender hostname', sender);
    return null;
  }
}

/**
 * Extract raw retURL query parameter from sender tab URL if present.
 * @param {chrome.runtime.MessageSender} sender
 * @returns {string|null}
 */
function getSenderRetURL(sender) {
  try {
    const tabUrl = sender?.tab?.url;
    if (typeof tabUrl !== 'string') {
      return null;
    }
    const retUrlMatch = tabUrl.match(/[?&]retURL=([^&]+)/);
    if (retUrlMatch?.[1]) {
      return retUrlMatch[1];
    }
    const startUrlMatch = tabUrl.match(/[?&]startURL=([^&]+)/);
    if (startUrlMatch?.[1]) {
      return decodeURIComponent(startUrlMatch[1]);
    }
    return null;
  } catch {
    return null;
  }
}

chrome.runtime.onInstalled.addListener(async ({ reason, previousVersion }) => {
  if (reason === 'update' || reason === 'install') {
    console.log(
      `Extension installation detected (${reason}, ${previousVersion}), clearing cache`
    );
    await CacheManager.clearAll();
    await loadSettings();
  }

  if (reason === 'install') {
    const url = chrome.runtime.getURL('welcome.html');
    await chrome.tabs.create({ url });
  }
});
