export const CONTENT_SCRIPTS_BASE_DOMAINS = [
  '.force.com',
  '.salesforce-setup.com',
];

export const MENU_CACHE_KEY = 'menuNodes';
export const MENU_CACHE_TTL = 3600 * 1000 * 24; // 12 hour

export const ENTITY_CACHE_KEY = 'entityDefinitions';
export const ENTITY_CACHE_TTL = 3600 * 1000 * 6; // 12 hour

export const CLIENT_ID =
  '3MVG9dAEux2v1sLuNHpwtD8XoDOCh2LFdy7QFtq9V5s03mu72XswHI9w7DJG7EcCLko8DdXfZjrQRZmmHI3Dm';
export const SCOPES = 'api refresh_token web openid';
export const SF_TOKEN_CACHE_KEY = 'sfToken';
export const SF_TOKEN_CACHE_TTL = 3600 * 1000 * 24; // 24 hour

// todo: those should be configurable
export const SETUP_SETUP_NODE = 'Setup';
export const PERSONAL_SETTING_SETUP_NODE = 'PersonalSettings';
export const SERVICE_SETUP_SETUP_NODE = 'ServiceSetup';
export const SETUP_NODE_TYPES = [
  SETUP_SETUP_NODE,
  PERSONAL_SETTING_SETUP_NODE,
  // SERVICE_SETUP_SETUP_NODE,
];
