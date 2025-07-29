export const CONTENT_SCRIPT_ENABLED_BASE_DOMAINS = [
  '.force.com',
  '.salesforce-setup.com',
  '.builder.salesforce-experience.com',
];
// handleCommand: ignored command "toggle-command-palette" on URL: https://carvago--integ.sandbox.my.salesforce.com/_ui/common/apex/debug/ApexCSIPage?sdtd=1

export const CONTENT_SCRIPT_DISABLED_BASE_DOMAINS = [
  '--c.sandbox.vf.force.com',
  '--c.vf.force.com',
];

export const GLOBAL_CACHE_SCOPE = 'global';

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

export const COMMAND_USAGE_KEY = 'commandUsage';

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
export const SOBJECT_ENTITY_TYPE = 'SObjectEntityType';
export const SOBJECT_FIELDS_RELATIONSHIPS_ENTITY_TYPE =
  'SObjectFieldsAndRelationships';
export const SOBJECT_PAGE_LAYOUTS_ENTITY_TYPE = 'PageLayouts';
export const SOBJECT_LIGHTNING_PAGES_ENTITY_TYPE = 'LightningPages';
export const SOBJECT_BUTTONS_LINKS_ACTIONS_ENTITY_TYPE = 'ButtonsLinksActions';
export const SOBJECT_COMPACT_LAYOUTS_ENTITY_TYPE = 'CompactLayouts';
export const SOBJECT_FIELD_SETS_ENTITY_TYPE = 'FieldSets';
export const SOBJECT_LIMITS_ENTITY_TYPE = 'Limits';
export const SOBJECT_RECORD_TYPES_ENTITY_TYPE = 'RecordTypes';
export const SOBJECT_RELATED_LOOKUP_FILTERS_ENTITY_TYPE =
  'RelatedLookupFilters';
export const SOBJECT_SEARCH_LAYOUTS_ENTITY_TYPE = 'MySearchLayouts';
export const SOBJECT_OBJECT_ACCESS_ENTITY_TYPE = 'ObjectAccess';
export const SOBJECT_APEX_TRIGGERS_ENTITY_TYPE = 'ApexTriggers';
export const SOBJECT_FLOW_TRIGGERS_ENTITY_TYPE = 'FlowTriggers';
export const SOBJECT_VALIDATION_RULES_ENTITY_TYPE = 'ValidationRules';

// Command settings for Flow Definitions
export const FLOW_DEFINITION_SETTINGS_KEY = 'FlowDefinition';
export const FLOW_DEFINITION_TYPE = 'Definition';
export const FLOW_LATEST_VERSION_TYPE = 'Latest';
export const FLOW_ACTIVE_VERSION_TYPE = 'Active';

export const CHANNEL_REFRESH_COMMANDS = 'refreshCommands';
export const CHANNEL_SEND_COMMANDS = 'sendCommands';
export const CHANNEL_INVOKE_AUTH_FLOW = 'invokeAuthFlow';
export const CHANNEL_COMPLETED_AUTH_FLOW = 'completedAuthFlow';
export const CHANNEL_OPEN_OPTIONS = 'openOptions';
export const CHANNEL_TOGGLE_COMMAND_PALETTE = 'toggleCommandPalette';
