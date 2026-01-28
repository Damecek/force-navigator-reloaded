/**
 * @fileoverview Static commands definitions for Salesforce Navigator.
 * These commands are common for all domains.
 */

import { getLabels } from '../shared';

const labels = getLabels([
  'commandStaticNewCustomObject',
  'commandStaticNewFlow',
  'commandStaticFlowTriggerExplorer',
  'commandStaticAppHome',
  'commandStaticFilesHome',
  'commandStaticDeveloperConsole',
  'commandStaticAgentforceVibes',
]);

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
    label: labels.commandStaticNewCustomObject,
    path: '/lightning/setup/ObjectManager/new',
  },
  {
    id: 'new-flow',
    label: labels.commandStaticNewFlow,
    path: '/builder_platform_interaction/flowBuilder.app',
  },
  {
    id: 'flow-trigger-explorer',
    label: labels.commandStaticFlowTriggerExplorer,
    path: '/interaction_explorer/flowExplorer.app',
  },
  {
    id: 'app-home',
    label: labels.commandStaticAppHome,
    path: '/lightning/page/home',
  },
  {
    id: 'files-home',
    label: labels.commandStaticFilesHome,
    path: '/lightning/o/ContentDocument/home',
  },
  {
    id: 'developer-console',
    label: labels.commandStaticDeveloperConsole,
    path: '/_ui/common/apex/debug/ApexCSIPage',
  },
  {
    id: 'agentforce-vibes',
    label: labels.commandStaticAgentforceVibes,
    path: '/runtime_developerplatform_codebuilder/codebuilder.app?launch=true',
  },
];
