import {
  CacheManager,
  Channel,
  CHANNEL_AUTOLOGIN_MYDOMAIN,
  AUTH_HELP_PAGE,
  CHANNEL_LOGIN_AS_PRIVATE,
  CHANNEL_OPEN_AUTH_HELP,
  CHANNEL_OPEN_OPTIONS,
  CHANNEL_OPEN_POPUP,
  CHANNEL_OPEN_REVIEW_PAGE,
  CHANNEL_REFRESH_COMMANDS,
  CHANNEL_SEND_COMMANDS,
  CHANNEL_TOGGLE_COMMAND_PALETTE,
  isContentScriptAllowedDomain,
  loadSettings,
  REVIEW_COMMAND_URL,
  toCoreUrl,
} from '../shared/index.js';
import { getCommands } from './commandRegister.js';
import {
  ensureToken,
  ensureWebScopedToken,
  tokenHasScope,
} from './auth/auth.js';
import { registerAuthFlowListeners } from './auth/authFlowController.js';
import { isRelativePath, requestFrontdoorUrl } from './auth/uiSessionBridge.js';

const DEFAULT_LANDING_PATH = '/lightning/page/home';

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

registerAuthFlowListeners();

new Channel(CHANNEL_AUTOLOGIN_MYDOMAIN).subscribe(async ({ sender }) => {
  const tabId = sender?.tab?.id;
  const orgHostname = getSenderHostname(sender);
  const senderRetURL = getSenderRetURL(sender);
  const retURL = isRelativePath(senderRetURL)
    ? senderRetURL
    : DEFAULT_LANDING_PATH;
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
      console.log(
        'MyDomain auto-login cancelled. Missing web-scoped token, refreshing commands.'
      );
      await refreshCommandsForTab(tabId, orgHostname);
      return;
    }
    const url = await requestFrontdoorUrl(token, retURL);
    console.log('MyDomain auto-login redirect', { orgHostname, retURL });
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

new Channel(CHANNEL_OPEN_AUTH_HELP).subscribe(() => {
  return chrome.tabs.create({ url: chrome.runtime.getURL(AUTH_HELP_PAGE) });
});

new Channel(CHANNEL_OPEN_REVIEW_PAGE).subscribe(() => {
  return chrome.tabs.create({ url: REVIEW_COMMAND_URL });
});

new Channel(CHANNEL_LOGIN_AS_PRIVATE).subscribe(async ({ data, sender }) => {
  const userId = data?.userId;
  if (typeof userId !== 'string' || !userId) {
    return;
  }
  const contextPath = normalizeContextPath(data?.contextPath);
  const orgHostname = getSenderHostname(sender);
  if (typeof orgHostname !== 'string' || !orgHostname) {
    return;
  }
  const token = await ensureToken(orgHostname);
  const sessionId = token?.access_token;
  const orgId = parseOrgIdFromSessionId(sessionId);
  if (typeof sessionId !== 'string' || !sessionId || !orgId) {
    return;
  }
  const query = new URLSearchParams({
    oid: orgId,
    suorgadminid: userId,
    retURL: contextPath,
    targetURL: contextPath,
  });
  const loginAsPath = `/servlet/servlet.su?${query.toString()}`;
  let url;
  if (tokenHasScope(token, 'web')) {
    try {
      url = await requestFrontdoorUrl(token, loginAsPath);
    } catch (error) {
      console.error('Private Login As failed', error, { orgHostname });
      return;
    }
  } else {
    console.log('Grant has no web scope; Login As opens without a session');
    url = `${toCoreUrl(orgHostname)}${loginAsPath}`;
  }
  await chrome.windows.create({
    url,
    incognito: true,
  });
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
 * Extract the decoded retURL or startURL query parameter from the sender tab URL if present.
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
      return decodeURIComponent(retUrlMatch[1]);
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

/**
 * Parses org id from Salesforce session/access token prefix (before `!`).
 * @param {string | undefined} sessionId
 * @returns {string | null}
 */
function parseOrgIdFromSessionId(sessionId) {
  if (typeof sessionId !== 'string' || !sessionId.includes('!')) {
    return null;
  }
  const [orgId] = sessionId.split('!');
  return orgId || null;
}

/**
 * Ensure context path is a relative path on the org and never empty.
 * @param {string | undefined} contextPath
 * @returns {string}
 */
function normalizeContextPath(contextPath) {
  if (typeof contextPath !== 'string' || !contextPath) {
    return '/';
  }
  const path = contextPath.startsWith('/') ? contextPath : `/${contextPath}`;
  return isRelativePath(path) ? path : '/';
}

/**
 * Refresh and publish command map for the current tab.
 * @param {number} tabId
 * @param {string} hostname
 * @returns {Promise<void>}
 */
async function refreshCommandsForTab(tabId, hostname) {
  if (typeof tabId !== 'number' || typeof hostname !== 'string' || !hostname) {
    return;
  }
  const commands = await getCommands(hostname);
  await new Channel(CHANNEL_SEND_COMMANDS).publish({
    data: commands,
    tabId,
  });
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
