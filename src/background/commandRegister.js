import {
  buildSetupCommands,
  buildEntityCommands,
  buildFlowCommands,
  buildLightningAppCommands,
  buildPermissionCommands,
  buildUserCommands,
} from '../navigator/builders.js';
import {
  APEX_CLASS_CACHE_KEY,
  APEX_CLASS_CACHE_TTL,
  APEX_CLASS_SETTINGS_KEY,
  APEX_TRIGGER_CACHE_KEY,
  APEX_TRIGGER_CACHE_TTL,
  APEX_TRIGGER_SETTINGS_KEY,
  CacheManager,
  COMMANDS_SETTINGS_KEY,
  CUSTOM_METADATA_ENTITY_TYPE,
  ENTITY_CACHE_KEY,
  ENTITY_CACHE_TTL,
  ENTITY_DEFINITION_SETTINGS_KEY,
  EXPERIENCE_SITE_CACHE_KEY,
  EXPERIENCE_SITE_CACHE_TTL,
  EXPERIENCE_SITE_SETTINGS_KEY,
  FLOW_ACTIVE_VERSION_TYPE,
  FLOW_CACHE_KEY,
  FLOW_CACHE_TTL,
  FLOW_DEFINITION_SETTINGS_KEY,
  FLOW_DEFINITION_TYPE,
  FLOW_LATEST_VERSION_TYPE,
  getSetting,
  LOGIN_AS_CACHE_KEY,
  LOGIN_AS_CACHE_TTL,
  isAutologinEnabled,
  LIGHTNING_APP_CACHE_KEY,
  LIGHTNING_APP_CACHE_TTL,
  LIGHTNING_APP_SETTINGS_KEY,
  MENU_CACHE_KEY,
  MENU_CACHE_TTL,
  LOGIN_AS_SETTINGS_KEY,
  PERMISSION_SET_CACHE_KEY,
  PERMISSION_SET_CACHE_TTL,
  PERMISSION_SET_GROUP_SETTINGS_KEY,
  PERMISSION_SET_SETTINGS_KEY,
  REVIEW_COMMAND_ENABLED_SETTINGS_KEY,
  REVIEW_COMMAND_SETTINGS_KEY,
  SOBJECT_ENTITY_TYPE,
  USER_CACHE_KEY,
  USER_CACHE_TTL,
  USERS_SETTINGS_KEY,
  toLightningHostname,
  UsageTracker,
} from '../shared/index.js';
import { staticCommands } from './staticCommands.js';
import { ensureToken, tokenHasScope } from './auth/auth.js';
import {
  fetchApexClassesFromSalesforce,
  fetchApexTriggersFromSalesforce,
  fetchEntityDefinitionsFromSalesforce,
  fetchExperienceSitesFromSalesforce,
  fetchFlowDefinitionsFromSalesforce,
  fetchLightningAppDefinitionsFromSalesforce,
  fetchMenuNodesFromSalesforce,
  fetchNetworksFromSalesforce,
  fetchPermissionSetGroupsFromSalesforce,
  fetchPermissionSetsFromSalesforce,
  fetchUsersFromSalesforce,
} from './salesforceUtils.js';
import {
  isAuthRefreshFailedError,
  SalesforceConnection,
} from './salesforceConnection.js';
import {
  buildApexClassCommands,
  buildApexTriggerCommands,
} from './commandSources/apexCommands.js';
import { buildExperienceSiteCommands } from './commandSources/experienceSiteCommands.js';

/**
 * Retrieves both static and dynamic commands for a given domain hostname.
 * @param {string} hostname Domain hostname (e.g., "myorg.lightning.force.com").
 * @returns {Promise<{NavigationCommand: import('./staticCommands').Command[], LoginAsCommand: object[], RefreshCommandListCommand: import('./staticCommands').Command[]}>} Object containing navigation commands and refresh command list.
 */
export async function getCommands(hostname) {
  const ExtensionOptionsCommand = [{}];
  const AuthorizeExtensionCommand = [{}];
  const unauthorizedCommands = {
    AuthorizeExtensionCommand,
    ExtensionOptionsCommand,
  };
  const token = await ensureToken(hostname);
  if (!token) {
    return unauthorizedCommands;
  }
  const instanceHostname = toLightningHostname(hostname);
  const connection = new SalesforceConnection({
    instanceUrl: token.instance_url,
    accessToken: token.access_token,
  });
  const loadUsers = createUsersLoader(connection);
  let NavigationCommand = [];
  let LoginAsCommand = [];
  try {
    const [
      loginAs,
      setup,
      entity,
      flow,
      apexClass,
      apexTrigger,
      experienceSite,
      lightningApp,
      permSet,
      userNav,
    ] = await Promise.all([
      getLoginAsCommands(instanceHostname, loadUsers),
      getSetupCommands(instanceHostname, connection),
      getEntityCommands(instanceHostname, connection),
      getFlowCommands(instanceHostname, connection),
      getApexClassCommands(instanceHostname, connection),
      getApexTriggerCommands(instanceHostname, connection),
      getExperienceSiteCommands(instanceHostname, connection),
      getLightningAppCommands(instanceHostname, connection),
      getPermissionSetCommands(instanceHostname, connection),
      getUserNavigationCommands(instanceHostname, loadUsers),
    ]);
    LoginAsCommand = loginAs;
    NavigationCommand = [
      ...staticCommands,
      ...setup,
      ...entity,
      ...flow,
      ...apexClass,
      ...apexTrigger,
      ...experienceSite,
      ...lightningApp,
      ...permSet,
      ...userNav,
    ];
  } catch (error) {
    if (isAuthRefreshFailedError(error)) {
      console.warn(
        'CommandRegister: authentication expired, falling back to authorize command set.'
      );
      return unauthorizedCommands;
    }
    throw error;
  }
  const autologinEnabled = await isAutologinEnabled();
  const requiresWebScopeReauthorize =
    autologinEnabled && !tokenHasScope(token, 'web');
  const RefreshCommandListCommand = [{}];
  const ResetCommandListUsageTracking = [{}];
  const ReviewCommand = [{}];
  const commandMap = {
    NavigationCommand,
    LoginAsCommand,
    RefreshCommandListCommand,
    ResetCommandListUsageTracking,
    ExtensionOptionsCommand,
  };
  if (requiresWebScopeReauthorize) {
    commandMap.AuthorizeExtensionCommand = AuthorizeExtensionCommand;
  }
  if (await shouldIncludeReviewCommand(commandMap)) {
    commandMap.ReviewCommand = ReviewCommand;
  }
  return commandMap;
}

export async function shouldIncludeReviewCommand(commandMap) {
  const reviewEnabled = await getSetting([
    REVIEW_COMMAND_SETTINGS_KEY,
    REVIEW_COMMAND_ENABLED_SETTINGS_KEY,
  ]);
  const tracker = await UsageTracker.instance();
  return isReviewCommandEligible({
    commandMap,
    reviewEnabled,
    totalUsage: await tracker.totalUsage(),
    activeDateCount: await tracker.activeDateCount(),
  });
}

export function isReviewCommandEligible({
  commandMap,
  reviewEnabled,
  totalUsage,
  activeDateCount,
}) {
  return (
    reviewEnabled === true &&
    !Object.prototype.hasOwnProperty.call(
      commandMap || {},
      'AuthorizeExtensionCommand'
    ) &&
    totalUsage >= 15 &&
    activeDateCount >= 3
  );
}

/**
 * Memoize the User fetch for a single command refresh cycle.
 * @param {SalesforceConnection} connection Salesforce connection instance
 * @returns {() => Promise<Array<{Id: string, Name: string}>>}
 */
function createUsersLoader(connection) {
  let usersPromise;

  return async () => {
    if (!usersPromise) {
      usersPromise = fetchUsersFromSalesforce(connection);
    }
    return usersPromise;
  };
}

/**
 * Loads command list from cache or builder callback and applies shared error handling.
 * @param {Object} options
 * @param {string} options.hostname
 * @param {string} options.cacheKey
 * @param {number} options.ttl
 * @param {() => Promise<import('./staticCommands').Command[]>} options.buildCommands
 * @param {string} options.sourceName
 * @returns {Promise<import('./staticCommands').Command[]>}
 */
async function getCommandsWithCache({
  hostname,
  cacheKey,
  ttl,
  buildCommands,
  sourceName,
}) {
  const cache = new CacheManager(hostname);
  const cachedCommands = await cache.get(cacheKey);
  if (cachedCommands) {
    return cachedCommands;
  }

  try {
    const commands = await buildCommands();
    console.log(sourceName, commands.length, commands);
    if (commands.length > 0) {
      await cache.set(cacheKey, commands, { ttl });
    }
    return commands;
  } catch (err) {
    if (isAuthRefreshFailedError(err)) {
      throw err;
    }
    console.error(
      `CommandRegister: failed to fetch ${sourceName} for ${hostname}`,
      err
    );
    return [];
  }
}

/**
 * Retrieves dynamic commands for a given domain via Salesforce API and cache.
 * @param {string} hostname Domain hostname (e.g., "myorg.lightning.force.com").
 * @param connection {SalesforceConnection} Salesforce connection instance
 * @returns {Promise<import('./staticCommands').Command[]>} Array of dynamic Command instances.
 */
async function getSetupCommands(hostname, connection) {
  return getCommandsWithCache({
    hostname,
    cacheKey: MENU_CACHE_KEY,
    ttl: MENU_CACHE_TTL,
    sourceName: 'getSetupCommands',
    buildCommands: async () => {
      const menuNodes = await fetchMenuNodesFromSalesforce(connection);
      return buildSetupCommands(menuNodes);
    },
  });
}

/**
 * Retrieves SObject and Custom Metadata navigation commands via Salesforce Tooling API.
 * @param {string} hostname Domain hostname (e.g., "myorg.lightning.force.com").
 * @param connection {SalesforceConnection} Salesforce connection instance
 * @returns {Promise<Array<{id: string, label: string, path: string}>>}
 */
async function getEntityCommands(hostname, connection) {
  return getCommandsWithCache({
    hostname,
    cacheKey: ENTITY_CACHE_KEY,
    ttl: ENTITY_CACHE_TTL,
    sourceName: 'getEntityCommands',
    buildCommands: async () => {
      const entities = await fetchEntityDefinitionsFromSalesforce(connection);
      const includeCustomMetadata = await getSetting([
        COMMANDS_SETTINGS_KEY,
        ENTITY_DEFINITION_SETTINGS_KEY,
        CUSTOM_METADATA_ENTITY_TYPE,
      ]);
      const includeSObjectSettings =
        (await getSetting([
          COMMANDS_SETTINGS_KEY,
          ENTITY_DEFINITION_SETTINGS_KEY,
          SOBJECT_ENTITY_TYPE,
        ])) ?? {};
      return buildEntityCommands(
        entities,
        includeCustomMetadata,
        includeSObjectSettings
      );
    },
  });
}

/**
 * Retrieves Flow navigation commands via Salesforce Tooling API.
 * @param {string} hostname Domain hostname (e.g., "myorg.lightning.force.com").
 * @param {SalesforceConnection} connection Salesforce connection instance
 * @returns {Promise<Array<{id: string, label: string, path: string}>>}
 */
async function getFlowCommands(hostname, connection) {
  return getCommandsWithCache({
    hostname,
    cacheKey: FLOW_CACHE_KEY,
    ttl: FLOW_CACHE_TTL,
    sourceName: 'getFlowCommands',
    buildCommands: async () => {
      const flows = await fetchFlowDefinitionsFromSalesforce(connection);
      const includeDefinition = await getSetting([
        COMMANDS_SETTINGS_KEY,
        FLOW_DEFINITION_SETTINGS_KEY,
        FLOW_DEFINITION_TYPE,
      ]);
      const includeLatest = await getSetting([
        COMMANDS_SETTINGS_KEY,
        FLOW_DEFINITION_SETTINGS_KEY,
        FLOW_LATEST_VERSION_TYPE,
      ]);
      const includeActive = await getSetting([
        COMMANDS_SETTINGS_KEY,
        FLOW_DEFINITION_SETTINGS_KEY,
        FLOW_ACTIVE_VERSION_TYPE,
      ]);

      return buildFlowCommands(flows, {
        includeDefinition,
        includeLatest,
        includeActive,
      });
    },
  });
}

/**
 * Retrieves Apex class navigation commands via Salesforce Tooling API.
 * @param {string} hostname Domain hostname
 * @param {SalesforceConnection} connection Salesforce connection instance
 * @returns {Promise<Array<{id: string, label: string, path: string}>>}
 */
async function getApexClassCommands(hostname, connection) {
  const includeApexClasses = await getSetting([
    COMMANDS_SETTINGS_KEY,
    APEX_CLASS_SETTINGS_KEY,
  ]);
  if (!includeApexClasses) {
    return [];
  }

  return getCommandsWithCache({
    hostname,
    cacheKey: APEX_CLASS_CACHE_KEY,
    ttl: APEX_CLASS_CACHE_TTL,
    sourceName: 'getApexClassCommands',
    buildCommands: async () =>
      buildApexClassCommands(await fetchApexClassesFromSalesforce(connection)),
  });
}

/**
 * Retrieves Apex trigger navigation commands via Salesforce Tooling API.
 * @param {string} hostname Domain hostname
 * @param {SalesforceConnection} connection Salesforce connection instance
 * @returns {Promise<Array<{id: string, label: string, path: string}>>}
 */
async function getApexTriggerCommands(hostname, connection) {
  const includeApexTriggers = await getSetting([
    COMMANDS_SETTINGS_KEY,
    APEX_TRIGGER_SETTINGS_KEY,
  ]);
  if (!includeApexTriggers) {
    return [];
  }

  return getCommandsWithCache({
    hostname,
    cacheKey: APEX_TRIGGER_CACHE_KEY,
    ttl: APEX_TRIGGER_CACHE_TTL,
    sourceName: 'getApexTriggerCommands',
    buildCommands: async () =>
      buildApexTriggerCommands(
        await fetchApexTriggersFromSalesforce(connection)
      ),
  });
}

/**
 * Retrieves Experience Cloud Workspace and Builder navigation commands.
 * @param {string} hostname Domain hostname
 * @param {SalesforceConnection} connection Salesforce connection instance
 * @returns {Promise<Array<{id: string, label: string, path: string, host: 'core'}>>}
 */
async function getExperienceSiteCommands(hostname, connection) {
  const includeExperienceSites = await getSetting([
    COMMANDS_SETTINGS_KEY,
    EXPERIENCE_SITE_SETTINGS_KEY,
  ]);
  if (!includeExperienceSites) {
    return [];
  }

  return getCommandsWithCache({
    hostname,
    cacheKey: EXPERIENCE_SITE_CACHE_KEY,
    ttl: EXPERIENCE_SITE_CACHE_TTL,
    sourceName: 'getExperienceSiteCommands',
    buildCommands: async () => {
      const [networks, sites] = await Promise.all([
        fetchNetworksFromSalesforce(connection),
        fetchExperienceSitesFromSalesforce(connection),
      ]);
      return buildExperienceSiteCommands(networks, sites);
    },
  });
}

/**
 * Retrieves Lightning App navigation commands via Salesforce Tooling API.
 * @param {string} hostname Domain hostname (e.g., "myorg.lightning.force.com").
 * @param {SalesforceConnection} connection Salesforce connection instance
 * @returns {Promise<Array<{id: string, label: string, path: string}>>}
 */
async function getLightningAppCommands(hostname, connection) {
  const includeLightningApps = await getSetting([
    COMMANDS_SETTINGS_KEY,
    LIGHTNING_APP_SETTINGS_KEY,
  ]);
  if (!includeLightningApps) {
    return [];
  }

  return getCommandsWithCache({
    hostname,
    cacheKey: LIGHTNING_APP_CACHE_KEY,
    ttl: LIGHTNING_APP_CACHE_TTL,
    sourceName: 'getLightningAppCommands',
    buildCommands: async () => {
      const apps = await fetchLightningAppDefinitionsFromSalesforce(connection);
      return buildLightningAppCommands(apps);
    },
  });
}

/**
 * Retrieves Permission Set and Permission Set Group commands.
 * @param {string} hostname Domain hostname (e.g., "myorg.lightning.force.com").
 * @param {SalesforceConnection} connection Salesforce connection instance
 * @returns {Promise<Array<{id: string, label: string, path: string}>>}
 */
async function getPermissionSetCommands(hostname, connection) {
  const includePermissionSets = await getSetting([
    COMMANDS_SETTINGS_KEY,
    PERMISSION_SET_SETTINGS_KEY,
  ]);
  const includePermissionSetGroups = await getSetting([
    COMMANDS_SETTINGS_KEY,
    PERMISSION_SET_GROUP_SETTINGS_KEY,
  ]);
  if (!includePermissionSets && !includePermissionSetGroups) {
    return [];
  }

  return getCommandsWithCache({
    hostname,
    cacheKey: PERMISSION_SET_CACHE_KEY,
    ttl: PERMISSION_SET_CACHE_TTL,
    sourceName: 'getPermissionSetCommands',
    buildCommands: async () => {
      const [permissionSets, permissionSetGroups] = await Promise.all([
        includePermissionSets
          ? fetchPermissionSetsFromSalesforce(connection)
          : Promise.resolve([]),
        includePermissionSetGroups
          ? fetchPermissionSetGroupsFromSalesforce(connection)
          : Promise.resolve([]),
      ]);

      return buildPermissionCommands(permissionSets, permissionSetGroups);
    },
  });
}

/**
 * Retrieves Users navigation commands.
 * @param {string} hostname Domain hostname (e.g., "myorg.lightning.force.com").
 * @param {() => Promise<Array<{Id: string, Name: string}>>} loadUsers
 *   Request-scoped User loader
 * @returns {Promise<Array<{id: string, label: string, path: string}>>}
 */
async function getUserNavigationCommands(hostname, loadUsers) {
  const includeUsers = await getSetting([
    COMMANDS_SETTINGS_KEY,
    USERS_SETTINGS_KEY,
  ]);
  if (!includeUsers) {
    return [];
  }

  return getCommandsWithCache({
    hostname,
    cacheKey: USER_CACHE_KEY,
    ttl: USER_CACHE_TTL,
    sourceName: 'getUserNavigationCommands',
    buildCommands: async () => {
      const users = await loadUsers();
      return buildUserCommands(users);
    },
  });
}

/**
 * Retrieves Login As commands for active users.
 * @param {string} hostname Domain hostname (e.g., "myorg.lightning.force.com").
 * @param {() => Promise<Array<{Id: string, Name: string}>>} loadUsers
 *   Request-scoped User loader
 * @returns {Promise<Array<{id: string, label: string, userId: string}>>}
 */
async function getLoginAsCommands(hostname, loadUsers) {
  const includeLoginAs = await getSetting([
    COMMANDS_SETTINGS_KEY,
    LOGIN_AS_SETTINGS_KEY,
  ]);
  if (!includeLoginAs) {
    return [];
  }

  return getCommandsWithCache({
    hostname,
    cacheKey: LOGIN_AS_CACHE_KEY,
    ttl: LOGIN_AS_CACHE_TTL,
    sourceName: 'getLoginAsCommands',
    buildCommands: async () => {
      const users = await loadUsers();
      const loginAsCommands = [];

      for (const user of users) {
        loginAsCommands.push({
          id: `login-as-${user.Id}`,
          label: `Administration > Users > ${user.Name} > Login As`,
          userId: user.Id,
        });
      }

      return loginAsCommands;
    },
  });
}
