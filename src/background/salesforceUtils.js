import {
  COMMANDS_SETTINGS_KEY,
  getSetting,
  SETUP_NODE_TYPES,
} from '../shared/index.js';
import { fetchMenuNodesFromSalesforce as fetchMenuNodes } from '../navigator/queries.js';
export * from '../navigator/queries.js';
/** Fetch Setup nodes using the extension settings. */
export async function fetchMenuNodesFromSalesforce(connection) {
  return fetchMenuNodes(connection, await getSetupNodeTypesFrom());
}
/** Return enabled Setup node types. */
export async function getSetupNodeTypesFrom() {
  return Object.entries(
    await getSetting([COMMANDS_SETTINGS_KEY, SETUP_NODE_TYPES])
  )
    .filter(([, value]) => Boolean(value))
    .map(([key]) => key);
}
