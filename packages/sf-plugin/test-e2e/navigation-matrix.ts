import type { NavigationCommand } from './cli.js';

export type NavigationCase = {
  name: string;
  id: RegExp;
  dom: (command: NavigationCommand) => string[][];
  objectVariant?: 'standard' | 'custom';
};

const parts = (command: NavigationCommand): string[] =>
  command.label
    .split('>')
    .map((part) => part.trim())
    .filter(Boolean);

const leaf = (command: NavigationCommand): string[][] => {
  const labels = parts(command);
  return [[labels.at(-1)!]];
};

const objectSection = (command: NavigationCommand): string[][] => {
  const labels = parts(command);
  return [[labels.at(-2)!], [labels.at(-1)!]];
};

const newEntity = (command: NavigationCommand): string[][] => {
  const labels = parts(command);
  return [[labels.at(-2)!], ['New']];
};

const customMetadataList = (command: NavigationCommand): string[][] => {
  const labels = parts(command);
  const typeLabel = labels.at(-2)!;
  return [
    [typeLabel, `${typeLabel}s`],
    ['New', 'Label'],
  ];
};

const customMetadataNew = (command: NavigationCommand): string[][] => {
  const labels = parts(command);
  return [[labels.at(-2)!], ['New', 'Edit']];
};

const objectSectionNamed =
  (...sectionLabels: string[]) =>
  (command: NavigationCommand): string[][] => {
    const labels = parts(command);
    return [[labels.at(-2)!], sectionLabels];
  };

const literal =
  (...values: string[]) =>
  () => [values];

const lightningApp = (command: NavigationCommand): string[][] => {
  const developerName = command.id
    .replace(/^lightning-app-(?:standard__|c__)?/, '')
    .replaceAll('_', ' ');
  return [[parts(command).at(-1)!, developerName]];
};

/** One live navigation case for every distinct route shape emitted by the catalog. */
export const navigationMatrix: NavigationCase[] = [
  { name: 'Setup node', id: /^Setup-/, dom: leaf },
  { name: 'Personal Settings node', id: /^PersonalSettings-/, dom: leaf },
  { name: 'Object details', id: /^sobject-setup-detail-/, dom: objectSection },
  {
    name: 'Object fields and relationships',
    id: /^sobject-setup-fields-and-relationship-/,
    dom: objectSection,
  },
  {
    name: 'Object page layouts',
    id: /^sobject-setup-page-layouts-/,
    dom: objectSection,
  },
  {
    name: 'Object Lightning pages',
    id: /^sobject-setup-lightning-pages-/,
    dom: objectSectionNamed('Lightning Pages', 'Lightning Record Pages'),
  },
  {
    name: 'Object buttons, links, and actions',
    id: /^sobject-setup-buttons-links-actions-/,
    dom: objectSection,
  },
  {
    name: 'Object compact layouts',
    id: /^sobject-setup-compact-layouts-/,
    dom: objectSection,
  },
  {
    name: 'Object field sets',
    id: /^sobject-setup-field-sets-/,
    dom: objectSection,
  },
  { name: 'Object limits', id: /^sobject-setup-limits-/, dom: objectSection },
  {
    name: 'Object record types',
    id: /^sobject-setup-record-types-/,
    dom: objectSection,
  },
  {
    name: 'Object related lookup filters',
    id: /^sobject-setup-related-lookup-filters-/,
    dom: objectSection,
  },
  {
    name: 'Object search layouts',
    id: /^sobject-setup-search-layouts-/,
    dom: objectSection,
  },
  {
    name: 'Object access',
    id: /^sobject-setup-object-access-/,
    dom: objectSection,
  },
  {
    name: 'Object Apex triggers',
    id: /^sobject-setup-apex-triggers-/,
    dom: objectSectionNamed('Apex Triggers', 'Triggers'),
  },
  {
    name: 'Object Flow triggers',
    id: /^sobject-setup-flow-triggers-/,
    dom: objectSection,
  },
  {
    name: 'Object validation rules',
    id: /^sobject-setup-validation-rules-/,
    dom: objectSection,
  },
  { name: 'New record', id: /^sobject-new-/, dom: newEntity },
  { name: 'Object list view', id: /^sobject-list-/, dom: objectSection },
  {
    name: 'Custom object details',
    id: /^sobject-setup-detail-/,
    dom: objectSection,
    objectVariant: 'custom',
  },
  {
    name: 'Custom object fields and relationships',
    id: /^sobject-setup-fields-and-relationship-/,
    dom: objectSection,
    objectVariant: 'custom',
  },
  {
    name: 'New custom object record',
    id: /^sobject-new-/,
    dom: newEntity,
    objectVariant: 'custom',
  },
  {
    name: 'Custom object list view',
    id: /^sobject-list-/,
    dom: objectSection,
    objectVariant: 'custom',
  },
  {
    name: 'New custom metadata record',
    id: /^custommetadata-new-/,
    dom: customMetadataNew,
  },
  {
    name: 'Custom metadata records',
    id: /^custommetadata-list-/,
    dom: customMetadataList,
  },
  { name: 'Flow definition', id: /^flow-definition-/, dom: leaf },
  { name: 'Latest Flow version', id: /^flow-latest-/, dom: leaf },
  { name: 'Active Flow version', id: /^flow-active-/, dom: leaf },
  { name: 'Apex class', id: /^apex-class-/, dom: leaf },
  { name: 'Apex trigger', id: /^apex-trigger-/, dom: leaf },
  {
    name: 'Experience Workspace',
    id: /^experience-site-workspace-/,
    dom: objectSection,
  },
  {
    name: 'Experience Builder',
    id: /^experience-site-builder-/,
    dom: () => [['Publish'], ['Components', 'Page Structure']],
  },
  {
    name: 'Standard Lightning app',
    id: /^lightning-app-standard__/,
    dom: lightningApp,
  },
  {
    name: 'Custom or namespaced Lightning app',
    id: /^lightning-app-(?!standard__)/,
    dom: lightningApp,
  },
  { name: 'Permission set', id: /^permission-set-(?!group-)/, dom: leaf },
  { name: 'Permission set group', id: /^permission-set-group-/, dom: leaf },
  { name: 'User details', id: /^user-/, dom: leaf },
  {
    name: 'New custom object',
    id: /^new-custom-object$/,
    dom: literal('New Custom Object'),
  },
  {
    name: 'New Flow',
    id: /^new-flow$/,
    dom: literal('New Automation', 'Get Started with Automations'),
  },
  {
    name: 'Flow Trigger Explorer',
    id: /^flow-trigger-explorer$/,
    dom: literal('Flow Trigger Explorer'),
  },
  { name: 'Application home', id: /^app-home$/, dom: literal('Home') },
  { name: 'Files home', id: /^files-home$/, dom: literal('Files') },
  {
    name: 'Developer Console',
    id: /^developer-console$/,
    dom: () => [['Query Editor'], ['Debug']],
  },
  { name: 'Web Console', id: /^web-console$/, dom: literal('Web Console') },
  {
    name: 'Agentforce Vibes',
    id: /^agentforce-vibes$/,
    dom: literal('Agentforce Vibes', 'Code Builder'),
  },
];
