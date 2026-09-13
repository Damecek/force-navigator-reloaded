import {
  COMMANDS_SETTINGS_KEY,
  getSetting,
  PERSONAL_SETTING_SETUP_NODE,
  SERVICE_SETUP_SETUP_NODE,
  SETUP_NODE_TYPES,
  SETUP_SETUP_NODE,
} from '../shared/index.js';

const ALLOWED_SETUP_NODE_TYPES = new Set([
  SETUP_SETUP_NODE,
  PERSONAL_SETTING_SETUP_NODE,
  SERVICE_SETUP_SETUP_NODE,
]);
import { fetchMenuNodesFromSalesforce as fetchMenuNodes } from '../navigator/queries.js';
export * from '../navigator/queries.js';
/** Fetch Setup nodes using the extension settings. */
export async function fetchMenuNodesFromSalesforce(connection) {
  return fetchMenuNodes(connection, await getSetupNodeTypesFrom());
}
/**
 * Keep enabled, known SetupNode types; unknown keys never reach the SOQL query.
 * @param {Record<string, unknown>|undefined} configured Setting value.
 * @returns {string[]}
 */
export function selectSetupNodeTypes(configured) {
  return Object.entries(configured ?? {})
    .filter(
      ([key, value]) => Boolean(value) && ALLOWED_SETUP_NODE_TYPES.has(key)
    )
    .map(([key]) => key);
}
/** Return enabled Setup node types from settings. */
export async function getSetupNodeTypesFrom() {
  return selectSetupNodeTypes(
    await getSetting([COMMANDS_SETTINGS_KEY, SETUP_NODE_TYPES])
  );
}
