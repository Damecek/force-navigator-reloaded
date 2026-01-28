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
  getMessage,
  getLabels,
  getSetting,
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
import { ensureToken } from './auth/auth.js';
import {
  fetchEntityDefinitionsFromSalesforce,
  fetchFlowDefinitionsFromSalesforce,
  fetchMenuNodesFromSalesforce,
} from './salesforceUtils';
import { SalesforceConnection } from './salesforceConnection';

const labels = getLabels([
  'objectManagerFieldsRelationships',
  'objectManagerPageLayouts',
  'objectManagerLightningPages',
  'objectManagerButtonsLinksActions',
  'objectManagerCompactLayouts',
  'objectManagerFieldSets',
  'objectManagerObjectLimits',
  'objectManagerRecordTypes',
  'objectManagerRelatedLookupFilters',
  'objectManagerSearchLayouts',
  'objectManagerObjectAccess',
  'objectManagerApexTriggers',
  'objectManagerFlowTriggers',
  'objectManagerValidationRules',
]);

const OBJECT_MANAGER_SECTIONS = [
  {
    settingKey: SOBJECT_FIELDS_RELATIONSHIPS_ENTITY_TYPE,
    id: 'fields-and-relationship',
    label: labels.objectManagerFieldsRelationships,
    pathSuffix: 'FieldsAndRelationships/view',
  },
  {
    settingKey: SOBJECT_PAGE_LAYOUTS_ENTITY_TYPE,
    id: 'page-layouts',
    label: labels.objectManagerPageLayouts,
    pathSuffix: 'PageLayouts/view',
  },
  {
    settingKey: SOBJECT_LIGHTNING_PAGES_ENTITY_TYPE,
    id: 'lightning-pages',
    label: labels.objectManagerLightningPages,
    pathSuffix: 'LightningPages/view',
  },
  {
    settingKey: SOBJECT_BUTTONS_LINKS_ACTIONS_ENTITY_TYPE,
    id: 'buttons-links-actions',
    label: labels.objectManagerButtonsLinksActions,
    pathSuffix: 'ButtonsLinksActions/view',
  },
  {
    settingKey: SOBJECT_COMPACT_LAYOUTS_ENTITY_TYPE,
    id: 'compact-layouts',
    label: labels.objectManagerCompactLayouts,
    pathSuffix: 'CompactLayouts/view',
  },
  {
    settingKey: SOBJECT_FIELD_SETS_ENTITY_TYPE,
    id: 'field-sets',
    label: labels.objectManagerFieldSets,
    pathSuffix: 'FieldSets/view',
  },
  {
    settingKey: SOBJECT_LIMITS_ENTITY_TYPE,
    id: 'limits',
    label: labels.objectManagerObjectLimits,
    pathSuffix: 'Limits/view',
  },
  {
    settingKey: SOBJECT_RECORD_TYPES_ENTITY_TYPE,
    id: 'record-types',
    label: labels.objectManagerRecordTypes,
    pathSuffix: 'RecordTypes/view',
  },
  {
    settingKey: SOBJECT_RELATED_LOOKUP_FILTERS_ENTITY_TYPE,
    id: 'related-lookup-filters',
    label: labels.objectManagerRelatedLookupFilters,
    pathSuffix: 'RelatedLookupFilters/view',
  },
  {
    settingKey: SOBJECT_SEARCH_LAYOUTS_ENTITY_TYPE,
    id: 'search-layouts',
    label: labels.objectManagerSearchLayouts,
    pathSuffix: 'SearchLayouts/view',
  },
  {
    settingKey: SOBJECT_OBJECT_ACCESS_ENTITY_TYPE,
    id: 'object-access',
    label: labels.objectManagerObjectAccess,
    pathSuffix: 'ObjectAccess/view',
  },
  {
    settingKey: SOBJECT_APEX_TRIGGERS_ENTITY_TYPE,
    id: 'apex-triggers',
    label: labels.objectManagerApexTriggers,
    pathSuffix: 'ApexTriggers/view',
  },
  {
    settingKey: SOBJECT_FLOW_TRIGGERS_ENTITY_TYPE,
    id: 'flow-triggers',
    label: labels.objectManagerFlowTriggers,
    pathSuffix: 'FlowTriggers/view',
  },
  {
    settingKey: SOBJECT_VALIDATION_RULES_ENTITY_TYPE,
    id: 'validation-rules',
    label: labels.objectManagerValidationRules,
    pathSuffix: 'ValidationRules/view',
  },
];

/**
 * Retrieves both static and dynamic commands for a given domain hostname.
 * @param {string} hostname Domain hostname (e.g., "myorg.lightning.force.com").
 * @returns {Promise<{NavigationCommand: import('./staticCommands').Command[], RefreshCommandListCommand: import('./staticCommands').Command[]}>} Object containing navigation commands and refresh command list.
 */
export async function getCommands(hostname) {
  const token = await ensureToken(hostname);
  const ExtensionOptionsCommand = [{}];
  if (!token) {
    return {
      AuthorizeExtensionCommand: [{}],
      ExtensionOptionsCommand,
    };
  }
  const instanceHostname = toLightningHostname(hostname);
  const connection = new SalesforceConnection({
    instanceUrl: token.instance_url,
    accessToken: token.access_token,
  });
  const NavigationCommand = [
    ...staticCommands,
    ...(await getSetupCommands(instanceHostname, connection)),
    ...(await getEntityCommands(instanceHostname, connection)),
    ...(await getFlowCommands(instanceHostname, connection)),
  ];
  const RefreshCommandListCommand = [{}];
  const ResetCommandListUsageTracking = [{}];
  return {
    NavigationCommand,
    RefreshCommandListCommand,
    ResetCommandListUsageTracking,
    ExtensionOptionsCommand,
  };
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
 * Retrieves dynamic commands for a given domain via Salesforce API and cache.
 * @param {string} hostname Domain hostname (e.g., "myorg.lightning.force.com").
 * @param connection {SalesforceConnection} Salesforce connection instance
 * @returns {Promise<import('./staticCommands').Command[]>} Array of dynamic Command instances.
 */
async function getSetupCommands(hostname, connection) {
  const cache = new CacheManager(hostname);
  const cachedCommands = await cache.get(MENU_CACHE_KEY);
  if (cachedCommands) {
    return cachedCommands;
  }
  try {
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
    const dedupedCommands = [
      ...new Map(commands.map((c) => [c.id, c])).values(),
    ];
    console.log('Setup Commands', dedupedCommands.length, dedupedCommands);
    if (dedupedCommands.length > 0) {
      await cache.set(MENU_CACHE_KEY, dedupedCommands, { ttl: MENU_CACHE_TTL });
    }
    return dedupedCommands;
  } catch (err) {
    console.error(
      `CommandRegister: failed to fetch dynamic commands for ${hostname}`,
      err
    );
    return [];
  }
}

/**
 * Retrieves SObject and Custom Metadata navigation commands via Salesforce Tooling API.
 * @param {string} hostname Domain hostname (e.g., "myorg.lightning.force.com").
 * @param connection {SalesforceConnection} Salesforce connection instance
 * @returns {Promise<Array<{id: string, label: string, path: string}>>}
 */
async function getEntityCommands(hostname, connection) {
  const cache = new CacheManager(hostname);
  const cachedCommands = await cache.get(ENTITY_CACHE_KEY);
  if (cachedCommands) {
    return cachedCommands;
  }
  try {
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
          label: getMessage('commandLabelCustomMetadataNew', Label),
          path: `/lightning/setup/CustomMetadata/page?address=/${KeyPrefix}/e`,
        });
        commands.push({
          id: `custommetadata-list-${KeyPrefix}`,
          label: getMessage('commandLabelCustomMetadataList', Label),
          path: `/lightning/setup/CustomMetadata/page?address=/${KeyPrefix}`,
        });
      } else {
        if (IsCustomizable && hasSObjectSettings) {
          commands.push({
            id: `sobject-setup-detail-${DurableId}`,
            label: getMessage('commandLabelObjectManagerDetails', Label),
            path: `/lightning/setup/ObjectManager/${DurableId}/Details/view`,
          });
          for (const section of OBJECT_MANAGER_SECTIONS) {
            if (includeSObjectSettings[section.settingKey]) {
              commands.push({
                id: `sobject-setup-${section.id}-${DurableId}`,
                label: getMessage('commandLabelObjectManagerSection', [
                  Label,
                  section.label,
                ]),
                path: `/lightning/setup/ObjectManager/${DurableId}/${section.pathSuffix}`,
              });
            }
          }
        }

        if (IsEverCreatable && IsCompactLayoutable) {
          commands.push({
            id: `sobject-new-${QualifiedApiName}`,
            label: getMessage('commandLabelApplicationNew', Label),
            path: `/lightning/o/${QualifiedApiName}/new`,
          });
        }
        if (IsEverCreatable && IsSearchLayoutable) {
          commands.push({
            id: `sobject-list-${QualifiedApiName}`,
            label: getMessage('commandLabelApplicationListView', Label),
            path: `/lightning/o/${QualifiedApiName}/home`,
          });
        }
      }
    }
    console.log('Entity Commands', commands.length, commands);
    if (commands.length > 0) {
      await cache.set(ENTITY_CACHE_KEY, commands, { ttl: ENTITY_CACHE_TTL });
    }
    return commands;
  } catch (err) {
    console.error(
      `CommandRegister: failed to fetch entity commands for ${hostname}`,
      err
    );
    return [];
  }
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
  const cache = new CacheManager(hostname);
  const cachedCommands = await cache.get(FLOW_CACHE_KEY);
  if (cachedCommands) {
    return cachedCommands;
  }
  try {
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
            label: getMessage('commandLabelFlowDefinition', label),
            path: `/lightning/setup/Flows/page?address=%2F${f.Id}`,
          });
        }
        if (f.LatestVersionId && includeLatest) {
          commands.push({
            id: `flow-latest-${f.Id}`,
            label: getMessage('commandLabelFlowLatest', label),
            path: `/builder_platform_interaction/flowBuilder.app?flowId=${f.LatestVersionId}`,
          });
        }
        if (f.ActiveVersionId && includeActive) {
          commands.push({
            id: `flow-active-${f.Id}`,
            label: getMessage('commandLabelFlowActive', label),
            path: `/builder_platform_interaction/flowBuilder.app?flowId=${f.ActiveVersionId}`,
          });
        }
      }
    }
    console.log('Flow Commands', commands.length, commands);
    if (commands.length > 0) {
      await cache.set(FLOW_CACHE_KEY, commands, { ttl: FLOW_CACHE_TTL });
    }
    return commands;
  } catch (err) {
    console.error(
      `CommandRegister: failed to fetch flow commands for ${hostname}`,
      err
    );
    return [];
  }
}
