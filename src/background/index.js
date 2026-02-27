import {
  CacheManager,
  Channel,
  CHANNEL_COMPLETED_AUTH_FLOW,
  CHANNEL_FAILED_AUTH_FLOW,
  CHANNEL_INVOKE_AUTH_FLOW,
  CHANNEL_OPEN_AUTH_HELP,
  CHANNEL_OPEN_OPTIONS,
  CHANNEL_OPEN_POPUP,
  CHANNEL_REFRESH_COMMANDS,
  CHANNEL_SEND_COMMANDS,
  CHANNEL_TOGGLE_COMMAND_PALETTE,
  CONNECTED_APP_INSTALL_APPROVAL_PATH,
  isContentScriptAllowedDomain,
  loadSettings,
  toLightningUrl,
  toCoreUrl,
} from '../shared';
import { getCommands } from './commandRegister';
import { interactiveLogin } from './auth/auth';

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
new Channel(CHANNEL_REFRESH_COMMANDS).subscribe(async ({ data, sender }) => {
  const hostname = getSenderHostname(sender) || data?.hostname || null;
  const commands = hostname ? await getCommands(hostname) : [];
  console.log('Commands to send:', commands);
  const tabId = getTargetTabId(data, sender);
  return new Channel(CHANNEL_SEND_COMMANDS).publish({
    data: commands,
    tabId,
  });
});

new Channel(CHANNEL_INVOKE_AUTH_FLOW).subscribe(async ({ data, sender }) => {
  const hostname = data?.hostname || getSenderHostname(sender) || null;
  const tabId = getSenderTabId(sender);
  if (!hostname) {
    return new Channel(CHANNEL_FAILED_AUTH_FLOW).publish({
      data: {
        message:
          'Auth flow failed: no Salesforce hostname provided. Open Guided Auth from a Salesforce tab.',
      },
      tabId,
    });
  }
  try {
    await interactiveLogin(hostname);
    return new Channel(CHANNEL_COMPLETED_AUTH_FLOW).publish({
      tabId,
    });
  } catch (error) {
    console.error('Auth flow failed', error);
    if (isBlockedByAdminAuthError(error)) {
      await openGuidedAuthPage({
        hostname,
        sourceTabId: tabId,
        oauthError: error?.oauthError,
        oauthErrorDescription: error?.oauthErrorDescription,
        remediation: 'blocked',
      });
      return new Channel(CHANNEL_FAILED_AUTH_FLOW).publish({
        data: {
          message:
            'Authorization is blocked by Salesforce admin. Open Connected Apps OAuth Usage from Guided Auth.',
        },
        tabId,
      });
    }
    if (shouldOpenGuidedAuth(error)) {
      await openGuidedAuthPage({
        hostname,
        sourceTabId: tabId,
        oauthError: error?.oauthError,
        oauthErrorDescription: error?.oauthErrorDescription,
      });
    }
    return new Channel(CHANNEL_FAILED_AUTH_FLOW).publish({
      data: { message: error?.message || 'Auth flow failed' },
      tabId,
    });
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

new Channel(CHANNEL_OPEN_AUTH_HELP).subscribe(({ data, sender }) => {
  const hostname = getSenderHostname(sender) || data?.hostname || null;
  const senderTabId = getSenderTabId(sender);
  const params = new URLSearchParams();
  if (hostname) {
    params.set('host', hostname);
  }
  if (typeof senderTabId === 'number') {
    params.set('sourceTabId', String(senderTabId));
  }
  const query = params.toString();
  const suffix = query ? `?${query}` : '';
  return chrome.tabs.create({
    url: chrome.runtime.getURL(`authHelp.html${suffix}`),
    active: true,
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
 * Safely extract sender tab id from a runtime message sender.
 * @param {chrome.runtime.MessageSender} sender
 * @returns {number|undefined}
 */
function getSenderTabId(sender) {
  return typeof sender?.tab?.id === 'number' ? sender.tab.id : undefined;
}

/**
 * Resolve target tab id from explicit payload or sender tab.
 * @param {{targetTabId?: number}|undefined} data
 * @param {chrome.runtime.MessageSender} sender
 * @returns {number|undefined}
 */
function getTargetTabId(data, sender) {
  if (typeof data?.targetTabId === 'number') {
    return data.targetTabId;
  }
  return getSenderTabId(sender);
}

/**
 * Return true when the auth failure indicates connected-app install requirement.
 * @param {any} error
 * @returns {boolean}
 */
function shouldOpenGuidedAuth(error) {
  const oauthError = String(error?.oauthError || '').trim();
  const oauthErrorDescription = String(
    error?.oauthErrorDescription || ''
  ).toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  if (
    oauthError === 'invalid_client' &&
    oauthErrorDescription.includes('app must be installed into org')
  ) {
    return true;
  }
  return (
    message.includes('authorization popup was closed before redirect') ||
    message.includes('the user did not approve access') ||
    oauthError === 'authorization_canceled' ||
    message.includes('app must be installed into org') ||
    (message.includes('invalid_client') &&
      message.includes('app must be installed into org'))
  );
}

/**
 * Returns true when auth failed because app is blocked by admin policy.
 * @param {any} error
 * @returns {boolean}
 */
function isBlockedByAdminAuthError(error) {
  const oauthError = String(error?.oauthError || '').trim();
  const oauthErrorDescription = String(
    error?.oauthErrorDescription || ''
  ).toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  return (
    (oauthError === 'OAUTH_APP_BLOCKED' &&
      oauthErrorDescription.includes('blocked by admin')) ||
    message.includes('oauth_app_blocked') ||
    message.includes('blocked by admin')
  );
}

/**
 * Open guided auth page in a new tab with host and install URL context.
 * @param {{hostname: string, sourceTabId?: number, oauthError?: string, oauthErrorDescription?: string}} options
 * @returns {Promise<chrome.tabs.Tab>}
 */
function openGuidedAuthPage({
  hostname,
  sourceTabId,
  oauthError,
  oauthErrorDescription,
  remediation = 'install',
}) {
  const params = new URLSearchParams({
    host: hostname,
    installUrl: `${toCoreUrl(hostname)}${CONNECTED_APP_INSTALL_APPROVAL_PATH}`,
    connectedAppsUsageUrl: `${toLightningUrl(hostname)}/lightning/setup/ConnectedAppsUsage/home`,
    remediation,
  });
  if (typeof sourceTabId === 'number') {
    params.set('sourceTabId', String(sourceTabId));
  }
  if (oauthError) {
    params.set('error', oauthError);
  }
  if (oauthErrorDescription) {
    params.set('errorDescription', oauthErrorDescription);
  }
  return chrome.tabs.create({
    url: chrome.runtime.getURL(`guidedAuth.html?${params.toString()}`),
    active: true,
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
