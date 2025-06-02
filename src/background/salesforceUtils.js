import { SalesforceConnection } from './salesforceConnection';
import { SETUP_NODE_TYPES } from './constants';

/**
 * @typedef {Object} SetupNode
 * @property {string} FullName
 * @property {string} NodeType
 * @property {string} Label
 * @property {string} IconUrl
 * @property {string} Url
 */

/**
 * Fetch menu nodes from Salesforce Aura endpoint.
 * @param {string} instanceUrl
 * @param {string} accessToken
 * @returns {Promise<SetupNode[]>}
 */
export async function fetchMenuNodesFromSalesforce(instanceUrl, accessToken) {
  console.log('Instancing new Salesforce Connection', instanceUrl, accessToken);
  const connection = new SalesforceConnection({
    instanceUrl,
    accessToken,
  });
  // todo: evaluate IconUrl for use in the UI
  const result = await connection.toolingQuery(
    `SELECT FullName, NodeType, Label, IconUrl, Url 
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
 * @param {string} instanceUrl Base URL for Salesforce instance (e.g., https://org.my.site.com)
 * @param {string} accessToken Session token or OAuth bearer for authentication.
 * @returns {Promise<EntityDefinition[]>}
 */
export async function fetchEntityDefinitionsFromSalesforce(
  instanceUrl,
  accessToken
) {
  console.log('Fetching EntityDefinition via Tooling API', instanceUrl);
  const connection = new SalesforceConnection({ instanceUrl, accessToken });
  const soql = `SELECT DurableId, KeyPrefix, Label, QualifiedApiName
    FROM EntityDefinition
    WHERE IsCustomizable = TRUE AND IsCustomSetting = FALSE
    ORDER BY QualifiedApiName`;
  return await connection.toolingQuery(soql);
}
