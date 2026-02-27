import {
  buildLightningUrl,
  CacheManager,
  COMMANDS_SETTINGS_KEY,
  CUSTOM_METADATA_ENTITY_TYPE,
  ENTITY_CACHE_KEY,
  ENTITY_CACHE_TTL,
  ENTITY_DEFINITION_SETTINGS_KEY,
  FLOW_ACTIVE_VERSION_TYPE,
  FLOW_CACHE_KEY,
  FLOW_CACHE_TTL,
  FLOW_DEFINITION_SETTINGS_KEY,
  FLOW_DEFINITION_TYPE,
  FLOW_LATEST_VERSION_TYPE,
  getSetting,
  isAutologinEnabled,
  LIGHTNING_APP_CACHE_KEY,
  LIGHTNING_APP_CACHE_TTL,
  LIGHTNING_APP_SETTINGS_KEY,
  MENU_CACHE_KEY,
  MENU_CACHE_TTL,
  SOBJECT_APEX_TRIGGERS_ENTITY_TYPE,
  SOBJECT_BUTTONS_LINKS_ACTIONS_ENTITY_TYPE,
  SOBJECT_COMPACT_LAYOUTS_ENTITY_TYPE,
  SOBJECT_ENTITY_TYPE,
  SOBJECT_FIELD_SETS_ENTITY_TYPE,
  SOBJECT_FIELDS_RELATIONSHIPS_ENTITY_TYPE,
  SOBJECT_FLOW_TRIGGERS_ENTITY_TYPE,
  SOBJECT_LIGHTNING_PAGES_ENTITY_TYPE,
  SOBJECT_LIMITS_ENTITY_TYPE,
  SOBJECT_OBJECT_ACCESS_ENTITY_TYPE,
  SOBJECT_PAGE_LAYOUTS_ENTITY_TYPE,
  SOBJECT_RECORD_TYPES_ENTITY_TYPE,
  SOBJECT_RELATED_LOOKUP_FILTERS_ENTITY_TYPE,
  SOBJECT_SEARCH_LAYOUTS_ENTITY_TYPE,
  SOBJECT_VALIDATION_RULES_ENTITY_TYPE,
  toLightningHostname,
} from '../shared';
import { staticCommands } from './staticCommands.js';
import { ensureToken, tokenHasScope } from './auth/auth.js';
import {
  fetchEntityDefinitionsFromSalesforce,
  fetchFlowDefinitionsFromSalesforce,
  fetchLightningAppDefinitionsFromSalesforce,
  fetchMenuNodesFromSalesforce,
} from './salesforceUtils';
import {
  isAuthRefreshFailedError,
  SalesforceConnection,
} from './salesforceConnection';

const OBJECT_MANAGER_SECTIONS = [
  {
    settingKey: SOBJECT_FIELDS_RELATIONSHIPS_ENTITY_TYPE,
    id: 'fields-and-relationship',
    label: 'Fields & Relationships',
    pathSuffix: 'FieldsAndRelationships/view',
  },
  {
    settingKey: SOBJECT_PAGE_LAYOUTS_ENTITY_TYPE,
    id: 'page-layouts',
    label: 'Page Layouts',
    pathSuffix: 'PageLayouts/view',
  },
  {
    settingKey: SOBJECT_LIGHTNING_PAGES_ENTITY_TYPE,
    id: 'lightning-pages',
    label: 'Lightning Pages',
    pathSuffix: 'LightningPages/view',
  },
  {
    settingKey: SOBJECT_BUTTONS_LINKS_ACTIONS_ENTITY_TYPE,
    id: 'buttons-links-actions',
    label: 'Buttons, Links, and Actions',
    pathSuffix: 'ButtonsLinksActions/view',
  },
  {
    settingKey: SOBJECT_COMPACT_LAYOUTS_ENTITY_TYPE,
    id: 'compact-layouts',
    label: 'Compact Layouts',
    pathSuffix: 'CompactLayouts/view',
  },
  {
    settingKey: SOBJECT_FIELD_SETS_ENTITY_TYPE,
    id: 'field-sets',
    label: 'Field Sets',
    pathSuffix: 'FieldSets/view',
  },
  {
    settingKey: SOBJECT_LIMITS_ENTITY_TYPE,
    id: 'limits',
    label: 'Object Limits',
    pathSuffix: 'Limits/view',
  },
  {
    settingKey: SOBJECT_RECORD_TYPES_ENTITY_TYPE,
    id: 'record-types',
    label: 'Record Types',
    pathSuffix: 'RecordTypes/view',
  },
  {
    settingKey: SOBJECT_RELATED_LOOKUP_FILTERS_ENTITY_TYPE,
    id: 'related-lookup-filters',
    label: 'Related Lookup Filters',
    pathSuffix: 'RelatedLookupFilters/view',
  },
  {
    settingKey: SOBJECT_SEARCH_LAYOUTS_ENTITY_TYPE,
    id: 'search-layouts',
    label: 'Search Layouts',
    pathSuffix: 'SearchLayouts/view',
  },
  {
    settingKey: SOBJECT_OBJECT_ACCESS_ENTITY_TYPE,
    id: 'object-access',
    label: 'Object Access',
    pathSuffix: 'ObjectAccess/view',
  },
  {
    settingKey: SOBJECT_APEX_TRIGGERS_ENTITY_TYPE,
    id: 'apex-triggers',
    label: 'Apex Triggers',
    pathSuffix: 'ApexTriggers/view',
  },
  {
    settingKey: SOBJECT_FLOW_TRIGGERS_ENTITY_TYPE,
    id: 'flow-triggers',
    label: 'Flow Triggers',
    pathSuffix: 'FlowTriggers/view',
  },
  {
    settingKey: SOBJECT_VALIDATION_RULES_ENTITY_TYPE,
    id: 'validation-rules',
    label: 'Validation Rules',
    pathSuffix: 'ValidationRules/view',
  },
];

/**
 * Retrieves both static and dynamic commands for a given domain hostname.
 * @param {string} hostname Domain hostname (e.g., "myorg.lightning.force.com").
 * @returns {Promise<{NavigationCommand: import('./staticCommands').Command[], RefreshCommandListCommand: import('./staticCommands').Command[]}>} Object containing navigation commands and refresh command list.
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
  let NavigationCommand = [];
  try {
    NavigationCommand = [
      ...staticCommands,
      ...(await getSetupCommands(instanceHostname, connection)),
      ...(await getEntityCommands(instanceHostname, connection)),
      ...(await getFlowCommands(instanceHostname, connection)),
      ...(await getLightningAppCommands(instanceHostname, connection)),
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
  const commandMap = {
    NavigationCommand,
    RefreshCommandListCommand,
    ResetCommandListUsageTracking,
    ExtensionOptionsCommand,
  };
  if (requiresWebScopeReauthorize) {
    commandMap.AuthorizeExtensionCommand = AuthorizeExtensionCommand;
  }
  return commandMap;
}

/**
 * Constructs breadcrumb mappings for menu nodes.
 * @param {Array<{FullName: string, Label: string}>} menuNodes Array of Salesforce setup nodes.
 * @returns {Object<string, string>} Map of FullName to breadcrumb trail.
 * @throws {TypeError} If menuNodes is not an array.
 */
function buildBreadcrumbs(menuNodes) {
  if (!Array.isArray(menuNodes)) {
    throw new TypeError('menuNodes must be an array');
  }

  const labelLookup = Object.create(null);
  for (const { FullName, Label } of menuNodes) {
    labelLookup[FullName] = Label;
  }
  const breadcrumbs = Object.create(null);
  for (const { FullName } of menuNodes) {
    const parts = FullName.split('.');
    const trail = [];

    for (let i = 1; i <= parts.length; i++) {
      const ancestor = parts.slice(0, i).join('.');
      const label = labelLookup[ancestor];
      if (label) {
        trail.push(label);
      } else {
        console.warn(`Missing label for ${ancestor}`);
      }
    }
    breadcrumbs[FullName] = trail.join(' > ');
  }

  return breadcrumbs;
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
      const breadcrumbs = buildBreadcrumbs(menuNodes);
      console.log('Breadcrumbs built', breadcrumbs);
      const commands = menuNodes
        .filter((node) => node.Url)
        .map((node) => ({
          id: `${node.NodeType}-${node.FullName}`,
          label: breadcrumbs[node.FullName],
          path: buildLightningUrl(node.FullName, node.NodeType),
        }));
      return [
        ...new Map(commands.map((command) => [command.id, command])).values(),
      ];
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
      const commands = [];
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
      const hasSObjectSettings = hasAnySObjectSettings(includeSObjectSettings);

      for (const e of entities) {
        const {
          DurableId,
          KeyPrefix,
          Label,
          QualifiedApiName,
          IsCustomizable,
          IsEverCreatable,
          IsCompactLayoutable,
          IsSearchLayoutable,
        } = e;
        if (QualifiedApiName.endsWith('__mdt') && includeCustomMetadata) {
          commands.push({
            id: `custommetadata-new-${KeyPrefix}`,
            label: `Custom Metadata Types > ${Label} > New`,
            path: `/lightning/setup/CustomMetadata/page?address=/${KeyPrefix}/e`,
          });
          commands.push({
            id: `custommetadata-list-${KeyPrefix}`,
            label: `Custom Metadata Types > ${Label} > List`,
            path: `/lightning/setup/CustomMetadata/page?address=/${KeyPrefix}`,
          });
        } else {
          if (IsCustomizable && hasSObjectSettings) {
            commands.push({
              id: `sobject-setup-detail-${DurableId}`,
              label: `Object Manager > ${Label} > Details`,
              path: `/lightning/setup/ObjectManager/${DurableId}/Details/view`,
            });
            for (const section of OBJECT_MANAGER_SECTIONS) {
              if (includeSObjectSettings[section.settingKey]) {
                commands.push({
                  id: `sobject-setup-${section.id}-${DurableId}`,
                  label: `Object Manager > ${Label} > ${section.label}`,
                  path: `/lightning/setup/ObjectManager/${DurableId}/${section.pathSuffix}`,
                });
              }
            }
          }

          if (IsEverCreatable && IsCompactLayoutable) {
            commands.push({
              id: `sobject-new-${QualifiedApiName}`,
              label: `Application > ${Label} > New`,
              path: `/lightning/o/${QualifiedApiName}/new`,
            });
          }
          if (IsEverCreatable && IsSearchLayoutable) {
            commands.push({
              id: `sobject-list-${QualifiedApiName}`,
              label: `Application > ${Label} > List View`,
              path: `/lightning/o/${QualifiedApiName}/home`,
            });
          }
        }
      }

      return commands;
    },
  });
}

function hasAnySObjectSettings(settings) {
  return Boolean(settings && Object.values(settings).some(Boolean));
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
      const commands = [];
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

      for (const f of flows) {
        const label = f?.LatestVersion?.MasterLabel;
        if (label) {
          if (includeDefinition) {
            commands.push({
              id: `flow-definition-${f.Id}`,
              label: `Flow > Definition > ${label}`,
              path: `/lightning/setup/Flows/page?address=%2F${f.Id}`,
            });
          }
          if (f.LatestVersionId && includeLatest) {
            commands.push({
              id: `flow-latest-${f.Id}`,
              label: `Flow > Latest Version > ${label}`,
              path: `/builder_platform_interaction/flowBuilder.app?flowId=${f.LatestVersionId}`,
            });
          }
          if (f.ActiveVersionId && includeActive) {
            commands.push({
              id: `flow-active-${f.Id}`,
              label: `Flow > Active Version > ${label}`,
              path: `/builder_platform_interaction/flowBuilder.app?flowId=${f.ActiveVersionId}`,
            });
          }
        }
      }

      return commands;
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
      return apps
        .filter((app) => app?.DeveloperName)
        .map((app) => {
          const appTarget = buildLightningAppTarget(
            app.NamespacePrefix,
            app.DeveloperName
          );
          return {
            id: `lightning-app-${appTarget}`,
            label: `Lightning App > ${app.Label}`,
            path: `/lightning/app/${appTarget}`,
          };
        });
    },
  });
}

/**
 * Build Lightning app target name based on namespace rules.
 * @param {string | null} namespacePrefix
 * @param {string} developerName
 * @returns {string}
 */
function buildLightningAppTarget(namespacePrefix, developerName) {
  const resolvedPrefix = namespacePrefix ? `${namespacePrefix}__` : 'c__';
  return `${resolvedPrefix}${developerName}`;
}
