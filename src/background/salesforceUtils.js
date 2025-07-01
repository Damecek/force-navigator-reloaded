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
 * Fetch menu nodes from Salesforce Aura endpoint.
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
 */

/**
 * Fetch EntityDefinition records (customizable sObjects and custom metadata) via Tooling API.
 * @param {SalesforceConnection} connection Salesforce connection instance
 * @returns {Promise<EntityDefinition[]>}
 */
export async function fetchEntityDefinitionsFromSalesforce(connection) {
  const soql = `SELECT DurableId, KeyPrefix, Label, QualifiedApiName
  FROM EntityDefinition
  WHERE IsCustomizable = TRUE AND IsCustomSetting = FALSE
  ORDER BY QualifiedApiName`;
  const result = await connection.toolingQuery(soql);
  console.log('EntityDefinition query:', soql, result);
  return result;
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
