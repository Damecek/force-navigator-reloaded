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
  const types = getSetupNodeTypesFrom();
  const result = await connection.toolingQuery(
    `SELECT FullName, NodeType, Label, Url
      FROM SetupNode
      WHERE NodeType IN ('${types.join("','")}')`
  );
  console.log('SetupNote query result', result);
  return result;
}

/**
 * Derive configured setup node types from settings.
 * @returns {string[]}
 */
export function getSetupNodeTypesFrom() {
  return Object.entries(getSetting([COMMANDS_SETTINGS_KEY, SETUP_NODE_TYPES]))
    .filter(([, enabled]) => Boolean(enabled))
    .map(([node]) => node);
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
  const result =
    await connection.toolingQuery(`SELECT DurableId, KeyPrefix, Label, QualifiedApiName
    FROM EntityDefinition
    WHERE IsCustomizable = TRUE AND IsCustomSetting = FALSE
    ORDER BY QualifiedApiName`);
  console.log('EntityDefinition query result', result);
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
  const result = await connection.toolingQuery(
    `SELECT ActiveVersionId, Id, LatestVersionId, LatestVersion.MasterLabel FROM FlowDefinition`
  );
  console.log('FlowDefinition query result', result);
  return result;
}
