import { SalesforceConnection } from './salesforceConnection';
import { COMMANDS_SETTINGS_KEY, getSetting, SETUP_NODE_TYPES } from '../shared';

/**
 * @typedef {Object} SetupNode
 * @property {string} FullName
 * @property {string} NodeType
 * @property {string} Label
 * @property {string} Url
 */

/**
 * Fetch menu nodes.
 * @param {SalesforceConnection} connection Salesforce connection instance
 * @returns {Promise<SetupNode[]>}
 */
export async function fetchMenuNodesFromSalesforce(connection) {
  const types = await getSetupNodeTypesFrom();
  const soql = `SELECT FullName, NodeType, Label, Url
    FROM SetupNode
    WHERE NodeType IN ('${types.join("','")}')`;
  const result = await connection.toolingQuery(soql);
  console.log('SetupNote query:', soql, result);
  return result;
}

/**
 * Derive configured setup node types from settings.
 * @returns {string[]}
 */
export async function getSetupNodeTypesFrom() {
  return Object.entries(
    await getSetting([COMMANDS_SETTINGS_KEY, SETUP_NODE_TYPES])
  )
    .filter(([, val]) => Boolean(val))
    .map(([key]) => key);
}

/**
 * @typedef {Object} EntityDefinition
 * @property {string} DurableId
 * @property {string} KeyPrefix
 * @property {string} Label
 * @property {string} QualifiedApiName
 * @property {boolean} IsCustomizable
 * @property {boolean} IsEverCreatable
 * @property {boolean} IsCompactLayoutable
 * @property {boolean} IsSearchLayoutable
 */

/**
 * Fetch EntityDefinition records (customizable sObjects and custom metadata) via Tooling API.
 * @param {SalesforceConnection} connection Salesforce connection instance
 * @returns {Promise<EntityDefinition[]>}
 */
export async function fetchEntityDefinitionsFromSalesforce(connection) {
  const baseSoql = `SELECT DurableId, KeyPrefix, Label, QualifiedApiName, IsCustomizable, IsEverCreatable, IsSearchLayoutable, IsCompactLayoutable
  FROM EntityDefinition
  WHERE IsCustomSetting = FALSE AND IsDeprecatedAndHidden = FALSE AND IsIdEnabled = TRUE
  ORDER BY QualifiedApiName`;
  const limit = 2000;
  let offset = 0;
  const allRecords = [];

  while (true) {
    const soql = `${baseSoql} LIMIT ${limit}${
      offset ? ` OFFSET ${offset}` : ''
    }`;
    const batch = await connection.toolingQuery(soql);
    console.log(
      'EntityDefinition query batch',
      soql,
      Array.isArray(batch) ? batch.length : 'n/a'
    );
    allRecords.push(...batch);
    if (!Array.isArray(batch) || batch.length < limit) {
      break;
    }
    offset += limit;
  }

  console.log('EntityDefinition total records', allRecords.length);
  return allRecords;
}

/**
 * @typedef {Object} FlowDefinition
 * @property {string} ActiveVersionId
 * @property {string} Id
 * @property {string} LatestVersionId
 * @property {{ MasterLabel: string }} LatestVersion
 */

/**
 * Fetch flow definitions via Tooling API.
 * @param {SalesforceConnection} connection Salesforce connection instance
 * @returns {Promise<FlowDefinition[]>}
 */
export async function fetchFlowDefinitionsFromSalesforce(connection) {
  const soql = `SELECT ActiveVersionId, Id, LatestVersionId, LatestVersion.MasterLabel FROM FlowDefinition`;
  const result = await connection.toolingQuery(soql);
  console.log('FlowDefinition query:', soql, result);
  return result;
}

/**
 * @typedef {Object} LightningAppDefinition
 * @property {string} DeveloperName
 * @property {string} Label
 * @property {string | null} NamespacePrefix
 */

/**
 * Fetch Lightning AppDefinition records via Tooling API.
 * @param {SalesforceConnection} connection Salesforce connection instance
 * @returns {Promise<LightningAppDefinition[]>}
 */
export async function fetchLightningAppDefinitionsFromSalesforce(connection) {
  const soql = `SELECT DeveloperName, Label, NamespacePrefix
    FROM AppDefinition
    WHERE UiType = 'Lightning' AND IsLargeFormFactorSupported = TRUE
    ORDER BY DeveloperName`;
  const result = await connection.query(soql);
  console.log('AppDefinition query:', soql, result);
  return result;
}
