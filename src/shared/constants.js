export const CONTENT_SCRIPTS_BASE_DOMAINS = [
  '.force.com',
  '.salesforce-setup.com',
];

export const MENU_CACHE_KEY = 'menuNodes';
export const MENU_CACHE_TTL = 3600 * 1000 * 24; // 12 hour

export const ENTITY_CACHE_KEY = 'entityDefinitions';
export const ENTITY_CACHE_TTL = 3600 * 1000 * 6; // 12 hour

export const COMMAND_CACHE_KEYS = [MENU_CACHE_KEY, ENTITY_CACHE_KEY];

/**
 * OAuth2 consumer key injected at build time.
 * @type {string}
 */
export const CLIENT_ID = __CLIENT_ID__;
export const SCOPES = 'api refresh_token';
export const SF_TOKEN_CACHE_KEY = 'sfToken';
export const SF_TOKEN_CACHE_TTL = 3600 * 1000 * 24 * 30; // 30 days

// todo: those should be configurable
export const SETUP_SETUP_NODE = 'Setup';
export const PERSONAL_SETTING_SETUP_NODE = 'PersonalSettings';
export const SERVICE_SETUP_SETUP_NODE = 'ServiceSetup';
export const SETUP_NODE_TYPES = [
  SETUP_SETUP_NODE,
  PERSONAL_SETTING_SETUP_NODE,
  // SERVICE_SETUP_SETUP_NODE,
];

export const CHANNEL_REFRESH_COMMANDS = 'refreshCommands';
export const CHANNEL_SEND_COMMANDS = 'sendCommands';
export const CHANNEL_INVOKE_AUTH_FLOW = 'invokeAuthFlow';
export const CHANNEL_COMPLETED_AUTH_FLOW = 'completedAuthFlow';
export const CHANNEL_TOGGLE_COMMAND_PALETTE = 'toggleCommandPalette';
