import {
  SOBJECT_APEX_TRIGGERS_ENTITY_TYPE,
  SOBJECT_BUTTONS_LINKS_ACTIONS_ENTITY_TYPE,
  SOBJECT_COMPACT_LAYOUTS_ENTITY_TYPE,
  SOBJECT_FIELDS_RELATIONSHIPS_ENTITY_TYPE,
  SOBJECT_FIELD_SETS_ENTITY_TYPE,
  SOBJECT_FLOW_TRIGGERS_ENTITY_TYPE,
  SOBJECT_LIGHTNING_PAGES_ENTITY_TYPE,
  SOBJECT_LIMITS_ENTITY_TYPE,
  SOBJECT_OBJECT_ACCESS_ENTITY_TYPE,
  SOBJECT_PAGE_LAYOUTS_ENTITY_TYPE,
  SOBJECT_RECORD_TYPES_ENTITY_TYPE,
  SOBJECT_RELATED_LOOKUP_FILTERS_ENTITY_TYPE,
  SOBJECT_SEARCH_LAYOUTS_ENTITY_TYPE,
  SOBJECT_VALIDATION_RULES_ENTITY_TYPE,
} from './constants.js';
import { buildLightningUrl } from './setupUrl.js';
import { supportsNewRecordNavigation } from './entityCommandSupport.js';

export const OBJECT_MANAGER_SECTIONS = [
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
      }
    }
    breadcrumbs[FullName] = trail.join(' > ');
  }

  return breadcrumbs;
}

/**
 * Build Setup navigation descriptors.
 * @param {import('./queries.js').SetupNode[]} menuNodes Setup menu records.
 * @returns {import('./staticCommands.js').Command[]}
 */
export function buildSetupCommands(menuNodes) {
  const breadcrumbs = buildBreadcrumbs(menuNodes);
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
}

/**
 * Build object navigation descriptors with explicitly selected sections.
 * @param {import('./queries.js').EntityDefinition[]} entities Object metadata.
 * @param {boolean} [includeCustomMetadata=true] Include custom metadata records.
 * @param {Record<string, boolean>} [includeSObjectSettings] Enabled object sections.
 * @returns {import('./staticCommands.js').Command[]}
 */
export function buildEntityCommands(
  entities,
  includeCustomMetadata = true,
  includeSObjectSettings = Object.fromEntries(
    OBJECT_MANAGER_SECTIONS.map((section) => [section.settingKey, true])
  )
) {
  const commands = [];
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

      if (
        supportsNewRecordNavigation({
          QualifiedApiName,
          IsEverCreatable,
          IsCompactLayoutable,
        })
      ) {
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
}
function hasAnySObjectSettings(settings) {
  return Boolean(settings && Object.values(settings).some(Boolean));
}

/**
 * Build flow definition and version navigation descriptors.
 * @param {import('./queries.js').FlowDefinition[]} flows Flow definitions.
 * @param {{includeDefinition?: boolean, includeLatest?: boolean, includeActive?: boolean}} [options] Enabled variants.
 * @returns {import('./staticCommands.js').Command[]}
 */
export function buildFlowCommands(
  flows,
  { includeDefinition = true, includeLatest = true, includeActive = true } = {}
) {
  const commands = [];
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
}

/**
 * Build Lightning app navigation descriptors.
 * @param {import('./queries.js').LightningAppDefinition[]} apps Lightning apps.
 * @returns {Array<import('./staticCommands.js').Command & {appTarget: string}>}
 */
export function buildLightningAppCommands(apps) {
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
        appTarget,
        path: `/lightning/app/${appTarget}`,
      };
    });
}
function buildLightningAppTarget(namespacePrefix, developerName) {
  const resolvedPrefix = namespacePrefix ? `${namespacePrefix}__` : 'c__';
  return `${resolvedPrefix}${developerName}`;
}

/**
 * Build permission set and group navigation descriptors.
 * @param {import('./queries.js').PermissionSetDefinition[]} [permissionSets] Permission sets.
 * @param {import('./queries.js').PermissionSetGroupDefinition[]} [permissionSetGroups] Permission set groups.
 * @returns {import('./staticCommands.js').Command[]}
 */
export function buildPermissionCommands(
  permissionSets = [],
  permissionSetGroups = []
) {
  const commands = [];
  for (const permissionSet of permissionSets) {
    if (permissionSet?.Id && permissionSet?.Label) {
      commands.push({
        id: `permission-set-${permissionSet.Id}`,
        label: `Permission Set > ${permissionSet.Label}`,
        path: `/lightning/setup/PermissionSetListView/page?address=%2F${permissionSet.Id}`,
      });
    }
  }

  for (const permissionSetGroup of permissionSetGroups) {
    if (permissionSetGroup?.Id && permissionSetGroup?.MasterLabel) {
      commands.push({
        id: `permission-set-group-${permissionSetGroup.Id}`,
        label: `Permission Set Group > ${permissionSetGroup.MasterLabel}`,
        path: `/lightning/setup/PermSetGroups/page?address=%2F${permissionSetGroup.Id}`,
      });
    }
  }

  return commands;
}

/**
 * Build user detail navigation descriptors.
 * @param {import('./queries.js').UserDefinition[]} users Active users.
 * @returns {import('./staticCommands.js').Command[]}
 */
export function buildUserCommands(users) {
  const navigationCommands = [];

  for (const user of users) {
    navigationCommands.push({
      id: `user-${user.Id}`,
      label: `Administration > Users > ${user.Name}`,
      path: `/lightning/setup/ManageUsersLightning/page?address=%2F${user.Id}%3Fnoredirect%3D1%26isUserEntityOverride%3D1`,
    });
  }

  return navigationCommands;
}
