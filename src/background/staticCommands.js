/**
 * @fileoverview Static commands definitions for Salesforce Navigator.
 * These commands are common for all domains.
 */

/**
 * @typedef {Object} Command
 * @property {string} id - Unique identifier of the command
 * @property {string} label - Display text shown in the command palette
 * @property {string} path - Path segment to navigate to (appended to origin)
 */

/**
 * List of static commands available in the command palette
 * @type {Command[]}
 */
export const staticCommands = [
  {
    id: 'new-custom-object',
    label: 'Object Manager > New Custom Object',
    path: '/lightning/setup/ObjectManager/new',
  },
  {
    id: 'new-flow',
    label: 'Platform Tools > Process Automation > New Flow Automation',
    path: '/builder_platform_interaction/flowBuilder.app',
  },
  {
    id: 'flow-trigger-explorer',
    label: 'Platform Tools > Process Automation > Flow Trigger Explorer',
    path: '/interaction_explorer/flowExplorer.app',
  },
  {
    id: 'app-home',
    label: 'Application > Home',
    path: '/lightning/page/home',
  },
  {
    id: 'files-home',
    label: 'Application > Files > Home',
    path: '/lightning/o/ContentDocument/home',
  },
];
