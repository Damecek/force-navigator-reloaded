import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadCatalog,
  SOURCE_NAMES,
  DEFAULT_SOURCES,
  DEFAULT_OBJECT_SECTIONS,
  DEFAULT_FLOW_OPTIONS,
  compareCommandUsage,
  buildSearchRecordsCommand,
  getSearchModeTerm,
} from '../src/navigator/index.js';

const records = {
  SetupNode: [
    { FullName: 'Root', Label: 'Setup', NodeType: 'Setup' },
    {
      FullName: 'Root.Users',
      Label: 'Users',
      NodeType: 'Setup',
      Url: '/users',
    },
  ],
  EntityDefinition: [
    {
      DurableId: 'Account',
      QualifiedApiName: 'Account',
      Label: 'Account',
      IsCustomizable: true,
      IsEverCreatable: true,
      IsCompactLayoutable: true,
      IsSearchLayoutable: true,
    },
    {
      DurableId: '01Itest',
      QualifiedApiName: 'Config__mdt',
      KeyPrefix: 'm00',
      Label: 'Config',
    },
  ],
  FlowDefinition: [
    {
      Id: '300flow',
      LatestVersionId: '301latest',
      ActiveVersionId: '301active',
      LatestVersion: { MasterLabel: 'Onboarding' },
    },
  ],
  ApexClass: [{ Id: '01pclass', Name: 'AccountService' }],
  ApexTrigger: [
    { Id: '01qtrigger', Name: 'AccountTrigger', TableEnumOrId: 'Account' },
  ],
  Network: [{ Id: '0DB000000000001AAA', Name: 'Portal', Status: 'Live' }],
  Site: [{ Id: '0DM000000000001AAA', MasterLabel: 'Portal' }],
  AppDefinition: [
    { DeveloperName: 'Sales', Label: 'Sales', NamespacePrefix: 'standard' },
  ],
  PermissionSet: [{ Id: '0PSperm', Label: 'Sales Access' }],
  PermissionSetGroup: [{ Id: '0PGgroup', MasterLabel: 'Sales Team' }],
  User: [{ Id: '005user', Name: 'Test User' }],
};
const query = async (soql) => records[/FROM\s+(\w+)/i.exec(soql)[1]] ?? [];

test('catalog imports without browser globals and loads every navigational family', async () => {
  assert.equal(typeof globalThis.chrome, 'undefined');
  const { commands, errors } = await loadCatalog({
    connection: { query, toolingQuery: query },
    sources: SOURCE_NAMES,
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(
    [...new Set(commands.map((command) => command.source))],
    SOURCE_NAMES
  );
  const byId = new Map(commands.map((command) => [command.id, command]));
  const expected = {
    'Setup-Root.Users':
      '/lightning/setup/Users/home?setupApp=all&SetupDomainProbePassed=true',
    'sobject-setup-fields-and-relationship-Account':
      '/lightning/setup/ObjectManager/Account/FieldsAndRelationships/view',
    'sobject-new-Account': '/lightning/o/Account/new',
    'sobject-list-Account': '/lightning/o/Account/home',
    'custommetadata-new-m00':
      '/lightning/setup/CustomMetadata/page?address=/m00/e',
    'custommetadata-list-m00':
      '/lightning/setup/CustomMetadata/page?address=/m00',
    'flow-definition-300flow': '/lightning/setup/Flows/page?address=%2F300flow',
    'flow-latest-300flow':
      '/builder_platform_interaction/flowBuilder.app?flowId=301latest',
    'apex-class-01pclass':
      '/lightning/setup/ApexClasses/page?address=%2F01pclass',
    'apex-trigger-01qtrigger':
      '/lightning/setup/ApexTriggers/page?address=%2F01qtrigger',
    'lightning-app-standard__Sales': '/lightning/app/standard__Sales',
    'permission-set-0PSperm':
      '/lightning/setup/PermissionSetListView/page?address=%2F0PSperm',
    'permission-set-group-0PGgroup':
      '/lightning/setup/PermSetGroups/page?address=%2F0PGgroup',
    'user-005user':
      '/lightning/setup/ManageUsersLightning/page?address=%2F005user%3Fnoredirect%3D1%26isUserEntityOverride%3D1',
  };
  for (const [id, path] of Object.entries(expected))
    assert.equal(byId.get(id)?.path, path, id);
  assert.equal(
    commands.filter((command) => command.id.startsWith('sobject-setup-'))
      .length,
    8
  );
  assert.equal(
    byId.get('experience-site-builder-0DM000000000001').host,
    'core'
  );
  assert.equal(byId.get('web-console').host, 'setup');
  assert.equal(
    commands.some((command) => command.id.startsWith('login-as')),
    false
  );
});

test('catalog distinguishes failed sources from empty sources and preserves successes', async () => {
  const { commands, errors } = await loadCatalog({
    sources: ['static', 'apex-classes', 'users'],
    connection: {
      query: async () => [],
      toolingQuery: async () => {
        throw new Error('Tooling access denied');
      },
    },
  });
  assert.equal(commands.length, 8);
  assert.deepEqual(errors, [
    { source: 'apex-classes', message: 'Tooling access denied' },
  ]);
});

test('catalog validates sources before querying and deduplicates requested families', async () => {
  await assert.rejects(
    loadCatalog({ sources: ['__proto__'] }),
    /Sources must be selected/
  );
  await assert.rejects(loadCatalog({ sources: ['users'] }), /connection/);
  assert.equal(
    (await loadCatalog({ sources: ['static', 'static'] })).commands.length,
    8
  );
  assert.deepEqual(await loadCatalog({ sources: [] }), {
    commands: [],
    errors: [],
  });
});

test('Service Setup routes use separate query parameters instead of HTML entities', async () => {
  const { buildSetupCommands } = await import('../src/navigator/builders.js');
  const [command] = buildSetupCommands([
    {
      FullName: 'Service.Users',
      Label: 'Users',
      NodeType: 'ServiceSetup',
      Url: '/users',
    },
  ]);
  const url = new URL(command.path, 'https://acme.lightning.force.com');
  assert.equal(url.searchParams.get('setupApp'), 'service');
  assert.equal(url.searchParams.get('SetupDomainProbePassed'), 'true');
  assert.equal(url.searchParams.has('amp;SetupDomainProbePassed'), false);
});

test('default catalog matches extension navigation settings without opt-in Apex sources', async () => {
  globalThis.__CLIENT_ID__ = 'test-client';
  const { DEFAULT_SETTINGS } = await import('../src/shared/settings.js');
  delete globalThis.__CLIENT_ID__;
  const settings = DEFAULT_SETTINGS.Commands;
  const calls = [];
  const connectionQuery = async (soql) => {
    calls.push(soql);
    return query(soql);
  };
  const { commands, errors } = await loadCatalog({
    connection: { query: connectionQuery, toolingQuery: connectionQuery },
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(
    [...new Set(commands.map((command) => command.source))],
    DEFAULT_SOURCES
  );
  assert.equal(
    calls.some((soql) => /FROM Apex(Class|Trigger)/.test(soql)),
    false
  );
  const ids = new Set(commands.map((command) => command.id));
  assert.ok(ids.has('flow-latest-300flow'));
  assert.equal(ids.has('flow-active-300flow'), false);
  assert.equal(ids.has('sobject-setup-page-layouts-Account'), false);
  assert.ok(ids.has('sobject-setup-lightning-pages-Account'));
  assert.deepEqual(
    settings.EntityDefinition.SObjectEntityType,
    DEFAULT_OBJECT_SECTIONS
  );
  assert.deepEqual(settings.FlowDefinition, {
    Definition: DEFAULT_FLOW_OPTIONS.includeDefinition,
    Latest: DEFAULT_FLOW_OPTIONS.includeLatest,
    Active: DEFAULT_FLOW_OPTIONS.includeActive,
  });
});

test('palette ordering uses descending usage with deterministic label ties', () => {
  const commands = [
    { label: 'Zebra', usage: 2 },
    { label: 'Beta' },
    { label: 'Alpha', usage: 2 },
    { label: 'Alpha' },
  ];
  assert.deepEqual(commands.sort(compareCommandUsage), [
    { label: 'Alpha', usage: 2 },
    { label: 'Zebra', usage: 2 },
    { label: 'Alpha' },
    { label: 'Beta' },
  ]);
});

test('global search descriptor preserves Unicode and URL punctuation through component encoding', async () => {
  const term = 'Žluťoučký 🐎 & /?# "客户"';
  const descriptor = buildSearchRecordsCommand(`  ${term}  `);
  const payload = JSON.parse(
    Buffer.from(descriptor.path.split('#')[1], 'base64').toString('utf8')
  );
  assert.deepEqual(payload, {
    componentDef: 'forceSearch:searchPageDesktop',
    attributes: { term },
  });
  assert.equal(descriptor.label, `Search > ${term}`);
  assert.equal(descriptor.host, 'lightning');
  const { buildLightningComponentUrl } =
    await import('../src/shared/urlUtils.js');
  assert.equal(
    buildLightningComponentUrl('acme.my.salesforce.com', payload),
    `https://acme.lightning.force.com${descriptor.path}`
  );
  assert.equal(getSearchModeTerm('  ? account  '), 'account');
  assert.equal(getSearchModeTerm('?'), '');
  assert.equal(getSearchModeTerm('account?'), null);
  assert.equal(buildSearchRecordsCommand('').label, 'Search');
});
