export {
  SALESFORCE_API_VERSION,
  SETUP_SETUP_NODE,
  PERSONAL_SETTING_SETUP_NODE,
  SERVICE_SETUP_SETUP_NODE,
  SOBJECT_FIELDS_RELATIONSHIPS_ENTITY_TYPE,
  SOBJECT_PAGE_LAYOUTS_ENTITY_TYPE,
  SOBJECT_LIGHTNING_PAGES_ENTITY_TYPE,
  SOBJECT_BUTTONS_LINKS_ACTIONS_ENTITY_TYPE,
  SOBJECT_COMPACT_LAYOUTS_ENTITY_TYPE,
  SOBJECT_FIELD_SETS_ENTITY_TYPE,
  SOBJECT_LIMITS_ENTITY_TYPE,
  SOBJECT_RECORD_TYPES_ENTITY_TYPE,
  SOBJECT_RELATED_LOOKUP_FILTERS_ENTITY_TYPE,
  SOBJECT_SEARCH_LAYOUTS_ENTITY_TYPE,
  SOBJECT_OBJECT_ACCESS_ENTITY_TYPE,
  SOBJECT_APEX_TRIGGERS_ENTITY_TYPE,
  SOBJECT_FLOW_TRIGGERS_ENTITY_TYPE,
  SOBJECT_VALIDATION_RULES_ENTITY_TYPE,
} from '../navigator/constants.js';
export const CONTENT_SCRIPT_ENABLED_BASE_DOMAINS = [
  '.force.com',
  '.my.site.com',
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
export const MENU_CACHE_TTL = 3600 * 1000 * 24; // 24 hours

export const ENTITY_CACHE_KEY = 'entityDefinitions';
export const ENTITY_CACHE_TTL = 3600 * 1000 * 6; // 6 hours

export const FLOW_CACHE_KEY = 'flowDefinitions';
export const FLOW_CACHE_TTL = 3600 * 1000 * 3; // 3 hour

export const APEX_CLASS_CACHE_KEY = 'apexClasses';
export const APEX_CLASS_CACHE_TTL = 3600 * 1000 * 6; // 6 hours

export const APEX_TRIGGER_CACHE_KEY = 'apexTriggers';
export const APEX_TRIGGER_CACHE_TTL = 3600 * 1000 * 6; // 6 hours

export const EXPERIENCE_SITE_CACHE_KEY = 'experienceSites';
export const EXPERIENCE_SITE_CACHE_TTL = 3600 * 1000 * 6; // 6 hours

export const LIGHTNING_APP_CACHE_KEY = 'lightningAppDefinitions';
export const LIGHTNING_APP_CACHE_TTL = 3600 * 1000 * 6; // 6 hour

export const PERMISSION_SET_CACHE_KEY = 'permissionSets';
export const PERMISSION_SET_CACHE_TTL = 3600 * 1000 * 6; // 6 hour

export const USER_CACHE_KEY = 'users';
export const USER_CACHE_TTL = 3600 * 1000 * 6; // 6 hour

export const LOGIN_AS_CACHE_KEY = 'loginAs';
export const LOGIN_AS_CACHE_TTL = 3600 * 1000 * 6; // 6 hour

export const COMMAND_CACHE_KEYS = [
  MENU_CACHE_KEY,
  ENTITY_CACHE_KEY,
  FLOW_CACHE_KEY,
  APEX_CLASS_CACHE_KEY,
  APEX_TRIGGER_CACHE_KEY,
  EXPERIENCE_SITE_CACHE_KEY,
  LIGHTNING_APP_CACHE_KEY,
  PERMISSION_SET_CACHE_KEY,
  USER_CACHE_KEY,
  LOGIN_AS_CACHE_KEY,
];

export const COMMAND_USAGE_KEY = 'commandUsage';
export const COMMAND_ACTIVITY_KEY = 'commandActivity';
export const REVIEW_COMMAND_SETTINGS_KEY = 'ReviewCommand';
export const REVIEW_COMMAND_ENABLED_SETTINGS_KEY = 'Enabled';
export const REVIEW_COMMAND_URL =
  'https://chromewebstore.google.com/detail/force-navigator-reloaded/iniflnopffblekndhplennjijdcfkeak/reviews?utm_source=extension_review_command';

/**
 * OAuth2 consumer key injected at build time.
 * @type {string}
 */
export const CLIENT_ID = __CLIENT_ID__;
export const SF_TOKEN_CACHE_KEY = 'sfToken';
export const AUTOLOGIN_SETTINGS_KEY = 'AutoLogin';
export const COMMAND_PALETTE_SETTINGS_KEY = 'CommandPalette';
export const COMMAND_PALETTE_SHOW_USAGE_SETTINGS_KEY = 'ShowUsage';

export const COMMANDS_SETTINGS_KEY = 'Commands';

// Command settings for Setup Nodes
export const SETUP_NODE_TYPES = 'SetupBased';

// Command settings for Entity Definitions
export const ENTITY_DEFINITION_SETTINGS_KEY = 'EntityDefinition';
export const CUSTOM_METADATA_ENTITY_TYPE = 'CustomMetadata';
export const SOBJECT_ENTITY_TYPE = 'SObjectEntityType';

// Command settings for Flow Definitions
export const FLOW_DEFINITION_SETTINGS_KEY = 'FlowDefinition';
export const FLOW_DEFINITION_TYPE = 'Definition';
export const FLOW_LATEST_VERSION_TYPE = 'Latest';
export const FLOW_ACTIVE_VERSION_TYPE = 'Active';

export const APEX_CLASS_SETTINGS_KEY = 'ApexClass';
export const APEX_TRIGGER_SETTINGS_KEY = 'ApexTrigger';
export const EXPERIENCE_SITE_SETTINGS_KEY = 'ExperienceSite';
export const LIGHTNING_APP_SETTINGS_KEY = 'LightningApplication';
export const PERMISSION_SET_SETTINGS_KEY = 'PermissionSet';
export const PERMISSION_SET_GROUP_SETTINGS_KEY = 'PermissionSetGroup';
export const USERS_SETTINGS_KEY = 'Users';
export const LOGIN_AS_SETTINGS_KEY = 'LoginAs';

export const CHANNEL_REFRESH_COMMANDS = 'refreshCommands';
export const CHANNEL_SEND_COMMANDS = 'sendCommands';
export const CHANNEL_INVOKE_AUTH_FLOW = 'invokeAuthFlow';
export const CHANNEL_COMPLETED_AUTH_FLOW = 'completedAuthFlow';
export const CHANNEL_FAILED_AUTH_FLOW = 'failedAuthFlow';
export const CHANNEL_OPEN_OPTIONS = 'openOptions';
export const CHANNEL_OPEN_POPUP = 'openPopup';
export const CHANNEL_OPEN_REVIEW_PAGE = 'openReviewPage';
export const CHANNEL_LOGIN_AS_PRIVATE = 'loginAsPrivate';
export const CHANNEL_TOGGLE_COMMAND_PALETTE = 'toggleCommandPalette';
export const CHANNEL_AUTOLOGIN_MYDOMAIN = 'autoLoginMyDomain';
