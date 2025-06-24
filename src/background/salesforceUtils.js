import { SalesforceConnection } from './salesforceConnection';
import { SETUP_NODE_TYPES } from '../shared';

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
  const result = await connection.toolingQuery(
    `SELECT FullName, NodeType, Label, Url
      FROM SetupNode
      WHERE NodeType IN ('${SETUP_NODE_TYPES.join("','")}')`
  );
  console.log('SetupNote query result', result);
  return result;
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
