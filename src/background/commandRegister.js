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

/**
 * Retrieves both static and dynamic commands for a given domain hostname.
 * @param {string} hostname Domain hostname (e.g., "myorg.lightning.force.com").
 * @returns {Promise<{NavigationCommand: import('./staticCommands').Command[], RefreshCommandListCommand: import('./staticCommands').Command[]}>} Object containing navigation commands and refresh command list.
 */
export async function getCommands(hostname) {
  const token = await ensureToken(hostname);
  if (!token) {
    return {
      AuthorizeExtensionCommand: [{}],
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
  return {
    NavigationCommand,
    RefreshCommandListCommand,
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
      await cache.set(MENU_CACHE_KEY, dedupedCommands, MENU_CACHE_TTL);
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
    const includeSObjectSettings = await getSetting([
      COMMANDS_SETTINGS_KEY,
      ENTITY_DEFINITION_SETTINGS_KEY,
      SOBJECT_ENTITY_TYPE,
    ]);

    for (const e of entities) {
      const { DurableId, KeyPrefix, Label, QualifiedApiName } = e;
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
      } else if (Object.values(includeSObjectSettings).some(Boolean)) {
        commands.push({
          id: `sobject-setup-detail-${DurableId}`,
          label: `Object Manager > ${Label} > Details`,
          path: `/lightning/setup/ObjectManager/${DurableId}/Details/view`,
        });
        if (includeSObjectSettings[SOBJECT_FIELDS_RELATIONSHIPS_ENTITY_TYPE]) {
          commands.push({
            id: `sobject-setup-fields-and-relationship-${DurableId}`,
            label: `Object Manager > ${Label} > Fields & Relationships`,
            path: `/lightning/setup/ObjectManager/${DurableId}/FieldsAndRelationships/view`,
          });
        }
        if (includeSObjectSettings[SOBJECT_PAGE_LAYOUTS_ENTITY_TYPE]) {
          commands.push({
            id: `sobject-setup-page-layouts-${DurableId}`,
            label: `Object Manager > ${Label} > Page Layouts`,
            path: `/lightning/setup/ObjectManager/${DurableId}/PageLayouts/view`,
          });
        }
        if (includeSObjectSettings[SOBJECT_LIGHTNING_PAGES_ENTITY_TYPE]) {
          commands.push({
            id: `sobject-setup-lightning-pages-${DurableId}`,
            label: `Object Manager > ${Label} > Lightning Pages`,
            path: `/lightning/setup/ObjectManager/${DurableId}/LightningPages/view`,
          });
        }
        if (includeSObjectSettings[SOBJECT_BUTTONS_LINKS_ACTIONS_ENTITY_TYPE]) {
          commands.push({
            id: `sobject-setup-buttons-links-actions-${DurableId}`,
            label: `Object Manager > ${Label} > Buttons, Links, and Actions`,
            path: `/lightning/setup/ObjectManager/${DurableId}/ButtonsLinksActions/view`,
          });
        }
        if (includeSObjectSettings[SOBJECT_COMPACT_LAYOUTS_ENTITY_TYPE]) {
          commands.push({
            id: `sobject-setup-compact-layouts-${DurableId}`,
            label: `Object Manager > ${Label} > Compact Layouts`,
            path: `/lightning/setup/ObjectManager/${DurableId}/CompactLayouts/view`,
          });
        }
        if (includeSObjectSettings[SOBJECT_FIELD_SETS_ENTITY_TYPE]) {
          commands.push({
            id: `sobject-setup-field-sets-${DurableId}`,
            label: `Object Manager > ${Label} > Field Sets`,
            path: `/lightning/setup/ObjectManager/${DurableId}/FieldSets/view`,
          });
        }
        if (includeSObjectSettings[SOBJECT_LIMITS_ENTITY_TYPE]) {
          commands.push({
            id: `sobject-setup-limits-${DurableId}`,
            label: `Object Manager > ${Label} > Object Limits`,
            path: `/lightning/setup/ObjectManager/${DurableId}/Limits/view`,
          });
        }
        if (includeSObjectSettings[SOBJECT_RECORD_TYPES_ENTITY_TYPE]) {
          commands.push({
            id: `sobject-setup-record-types-${DurableId}`,
            label: `Object Manager > ${Label} > Record Types`,
            path: `/lightning/setup/ObjectManager/${DurableId}/RecordTypes/view`,
          });
        }
        if (
          includeSObjectSettings[SOBJECT_RELATED_LOOKUP_FILTERS_ENTITY_TYPE]
        ) {
          commands.push({
            id: `sobject-setup-related-lookup-filters-${DurableId}`,
            label: `Object Manager > ${Label} > Related Lookup Filters`,
            path: `/lightning/setup/ObjectManager/${DurableId}/RelatedLookupFilters/view`,
          });
        }
        if (includeSObjectSettings[SOBJECT_SEARCH_LAYOUTS_ENTITY_TYPE]) {
          commands.push({
            id: `sobject-setup-search-layouts-${DurableId}`,
            label: `Object Manager > ${Label} > Search Layouts`,
            path: `/lightning/setup/ObjectManager/${DurableId}/SearchLayouts/view`,
          });
        }
        if (includeSObjectSettings[SOBJECT_OBJECT_ACCESS_ENTITY_TYPE]) {
          commands.push({
            id: `sobject-setup-object-access-${DurableId}`,
            label: `Object Manager > ${Label} > Object Access`,
            path: `/lightning/setup/ObjectManager/${DurableId}/ObjectAccess/view`,
          });
        }
        if (includeSObjectSettings[SOBJECT_APEX_TRIGGERS_ENTITY_TYPE]) {
          commands.push({
            id: `sobject-setup-apex-triggers-${DurableId}`,
            label: `Object Manager > ${Label} > Apex Triggers`,
            path: `/lightning/setup/ObjectManager/${DurableId}/ApexTriggers/view`,
          });
        }
        if (includeSObjectSettings[SOBJECT_FLOW_TRIGGERS_ENTITY_TYPE]) {
          commands.push({
            id: `sobject-setup-flow-triggers-${DurableId}`,
            label: `Object Manager > ${Label} > Flow Triggers`,
            path: `/lightning/setup/ObjectManager/${DurableId}/FlowTriggers/view`,
          });
        }
        if (includeSObjectSettings[SOBJECT_VALIDATION_RULES_ENTITY_TYPE]) {
          commands.push({
            id: `sobject-setup-validation-rules-${DurableId}`,
            label: `Object Manager > ${Label} > Validation Rules`,
            path: `/lightning/setup/ObjectManager/${DurableId}/ValidationRules/view`,
          });
        }
        commands.push({
          id: `sobject-new-${QualifiedApiName}`,
          label: `${Label} > New`,
          path: `/lightning/o/${QualifiedApiName}/new`,
        });
        commands.push({
          id: `sobject-list-${QualifiedApiName}`,
          label: `${Label} > List View`,
          path: `/lightning/o/${QualifiedApiName}/list`,
        });
      }
    }
    console.log('Entity Commands', commands.length, commands);
    if (commands.length > 0) {
      await cache.set(ENTITY_CACHE_KEY, commands, ENTITY_CACHE_TTL);
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
    console.log('Flow Commands', commands.length, commands);
    if (commands.length > 0) {
      await cache.set(FLOW_CACHE_KEY, commands, FLOW_CACHE_TTL);
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
