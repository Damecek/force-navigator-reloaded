export const CONTENT_SCRIPTS_BASE_DOMAINS = [
  '.force.com',
  '.salesforce-setup.com',
];

export const MENU_CACHE_KEY = 'menuNodes';
export const MENU_CACHE_TTL = 3600 * 1000 * 24; // 12 hour

export const ENTITY_CACHE_KEY = 'entityDefinitions';
export const ENTITY_CACHE_TTL = 3600 * 1000 * 6; // 12 hour

export const FLOW_CACHE_KEY = 'flowDefinitions';
export const FLOW_CACHE_TTL = 3600 * 1000 * 3; // 3 hour

export const COMMAND_CACHE_KEYS = [
  MENU_CACHE_KEY,
  ENTITY_CACHE_KEY,
  FLOW_CACHE_KEY,
];

/**
 * OAuth2 consumer key injected at build time.
 * @type {string}
 */
export const CLIENT_ID = __CLIENT_ID__;
export const SCOPES = 'api refresh_token';
export const SF_TOKEN_CACHE_KEY = 'sfToken';

export const COMMANDS_SETTINGS_KEY = 'Commands';

// Command settings for Setup Nodes
export const SETUP_NODE_TYPES = 'SetupBased';
export const SETUP_SETUP_NODE = 'Setup';
export const PERSONAL_SETTING_SETUP_NODE = 'PersonalSettings';
export const SERVICE_SETUP_SETUP_NODE = 'ServiceSetup';

// Command settings for Entity Definitions
export const ENTITY_DEFINITION_SETTINGS_KEY = 'EntityDefinition';
export const CUSTOM_METADATA_ENTITY_TYPE = 'CustomMetadata';
export const SOBJECT_ENTITY_TYPE = 'SObject';

// Command settings for Flow Definitions
export const FLOW_DEFINITION_SETTINGS_KEY = 'FlowDefinition';
export const FLOW_DEFINITION_TYPE = 'Definition';
export const FLOW_LATEST_VERSION_TYPE = 'Latest';
export const FLOW_ACTIVE_VERSION_TYPE = 'Active';

export const CHANNEL_REFRESH_COMMANDS = 'refreshCommands';
export const CHANNEL_SEND_COMMANDS = 'sendCommands';
export const CHANNEL_INVOKE_AUTH_FLOW = 'invokeAuthFlow';
export const CHANNEL_COMPLETED_AUTH_FLOW = 'completedAuthFlow';
export const CHANNEL_TOGGLE_COMMAND_PALETTE = 'toggleCommandPalette';
