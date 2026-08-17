import test from 'node:test';
import assert from 'node:assert/strict';
import uFuzzy from '@leeoniya/ufuzzy';
import {
  filterCommandsBySearchTerm,
  normalizeSearchValue,
  normalizeSearchValueWithMap,
} from '../src/lwc/modules/content/x/commandPalette/searchMatching.js';

function createUfuzzy() {
  return new uFuzzy({ intraMode: 1, intraSub: 0, intraDel: 0 });
}

test('normalizeSearchValue strips Latin diacritics for matching', () => {
  assert.equal(normalizeSearchValue('Farkaš'), 'farkas');
  assert.equal(normalizeSearchValue('Lukáš Zářecký'), 'lukas zarecky');
  assert.equal(normalizeSearchValue('Žluťoučký kůň'), 'zlutoucky kun');
});

test('normalizeSearchValue exposes CamelCase metadata words', () => {
  assert.equal(
    normalizeSearchValue('Apex Class > JsonRpcModuleBuilder'),
    'apex class > json rpc module builder'
  );
});

test('normalizeSearchValueWithMap keeps source ranges for precomposed Czech diacritics', () => {
  assert.deepEqual(normalizeSearchValueWithMap('Farkaš'), {
    normalized: 'farkas',
    sourceRanges: [
      { start: 0, end: 1 },
      { start: 1, end: 2 },
      { start: 2, end: 3 },
      { start: 3, end: 4 },
      { start: 4, end: 5 },
      { start: 5, end: 6 },
    ],
  });
});

test('normalizeSearchValueWithMap keeps combining marks in the matched source range', () => {
  assert.deepEqual(normalizeSearchValueWithMap('Farkas\u030c'), {
    normalized: 'farkas',
    sourceRanges: [
      { start: 0, end: 1 },
      { start: 1, end: 2 },
      { start: 2, end: 3 },
      { start: 3, end: 4 },
      { start: 4, end: 5 },
      { start: 5, end: 7 },
    ],
  });
});

test('ASCII query matches accented label', () => {
  const commands = [{ id: '1', label: 'Farkaš', usage: 0 }];

  const result = filterCommandsBySearchTerm({
    uf: createUfuzzy(),
    commands,
    previousResults: commands,
    searchTerm: 'farkas',
    previousSearchTerm: '',
  });

  assert.deepEqual(result, [
    { ...commands[0], matchRanges: [{ start: 0, end: 6 }] },
  ]);
});

test('Accented query matches ASCII label', () => {
  const commands = [{ id: '1', label: 'Farkas', usage: 0 }];

  const result = filterCommandsBySearchTerm({
    uf: createUfuzzy(),
    commands,
    previousResults: commands,
    searchTerm: 'farkaš',
    previousSearchTerm: '',
  });

  assert.deepEqual(result, [
    { ...commands[0], matchRanges: [{ start: 0, end: 6 }] },
  ]);
});

test('ASCII query matches accented surname within a full name label', () => {
  const commands = [{ id: '1', label: 'Lukáš Zářecký', usage: 0 }];

  const result = filterCommandsBySearchTerm({
    uf: createUfuzzy(),
    commands,
    previousResults: commands,
    searchTerm: 'zare',
    previousSearchTerm: '',
  });

  assert.deepEqual(result, [
    { ...commands[0], matchRanges: [{ start: 6, end: 10 }] },
  ]);
});

test('plain ASCII matching still works and preserves ordering from fuzzy search', () => {
  const commands = [
    { id: '1', label: 'Flow Builder', usage: 0 },
    { id: '2', label: 'Object Manager', usage: 0 },
  ];

  const result = filterCommandsBySearchTerm({
    uf: createUfuzzy(),
    commands,
    previousResults: commands,
    searchTerm: 'flow',
    previousSearchTerm: '',
  });

  assert.deepEqual(result, [
    { ...commands[0], matchRanges: [{ start: 0, end: 4 }] },
  ]);
});

test('associates ranges with the matching descriptor after uFuzzy reorders results', () => {
  const commands = [
    { id: 'first', label: 'First command', usage: 0 },
    { id: 'second', label: 'Second command', usage: 0 },
  ];
  const uf = {
    search() {
      return [
        [0, 1],
        {
          idx: [0, 1],
          ranges: [
            [0, 5],
            [7, 14],
          ],
        },
        [1, 0],
      ];
    },
  };

  const result = filterCommandsBySearchTerm({
    uf,
    commands,
    previousResults: commands,
    searchTerm: 'command',
    previousSearchTerm: '',
  });

  assert.deepEqual(result, [
    { ...commands[1], matchRanges: [{ start: 7, end: 14 }] },
    { ...commands[0], matchRanges: [{ start: 0, end: 5 }] },
  ]);
  assert.equal('matchRanges' in commands[0], false);
  assert.equal('matchRanges' in commands[1], false);
});

test('translates multiple uFuzzy ranges back to source label ranges', () => {
  const commands = [{ id: 'object', label: 'Object Manager', usage: 0 }];

  const result = filterCommandsBySearchTerm({
    uf: createUfuzzy(),
    commands,
    previousResults: commands,
    searchTerm: 'obj man',
    previousSearchTerm: '',
  });

  assert.deepEqual(result, [
    {
      ...commands[0],
      matchRanges: [
        { start: 0, end: 3 },
        { start: 7, end: 10 },
      ],
    },
  ]);
});

test('keeps highlight ranges when the query contains three terms', () => {
  const commands = [
    {
      id: 'custom-metadata',
      label: 'Custom Metadata Types > Access Token > List',
      usage: 0,
    },
  ];

  const result = filterCommandsBySearchTerm({
    uf: createUfuzzy(),
    commands,
    previousResults: commands,
    searchTerm: 'cus met t',
    previousSearchTerm: '',
  });

  assert.deepEqual(result, [
    {
      ...commands[0],
      matchRanges: [
        { start: 0, end: 3 },
        { start: 7, end: 10 },
        { start: 13, end: 14 },
      ],
    },
  ]);
});

test('matches separate terms inside CamelCase metadata names', () => {
  const commands = [
    {
      id: 'json-rpc-module-builder',
      label: 'Apex Class > JsonRpcModuleBuilder',
      usage: 0,
    },
  ];

  const result = filterCommandsBySearchTerm({
    uf: createUfuzzy(),
    commands,
    previousResults: commands,
    searchTerm: 'apex Jso Modul',
    previousSearchTerm: '',
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].id, commands[0].id);
  assert.ok(result[0].matchRanges.length > 0);
});

test('translates fuzzy ranges to cover decomposed combining marks in the source label', () => {
  const commands = [{ id: 'farkas', label: 'Farkas\u030c', usage: 0 }];

  const result = filterCommandsBySearchTerm({
    uf: createUfuzzy(),
    commands,
    previousResults: commands,
    searchTerm: 'farkas',
    previousSearchTerm: '',
  });

  assert.deepEqual(result, [
    { ...commands[0], matchRanges: [{ start: 0, end: 7 }] },
  ]);
});

test('translates ranges after an astral character using UTF-16 offsets', () => {
  const commands = [{ id: 'farkas', label: '😀Farkaš', usage: 0 }];

  const result = filterCommandsBySearchTerm({
    uf: createUfuzzy(),
    commands,
    previousResults: commands,
    searchTerm: 'farkas',
    previousSearchTerm: '',
  });

  assert.deepEqual(result, [
    { ...commands[0], matchRanges: [{ start: 2, end: 8 }] },
  ]);
});

test('incremental narrowing uses normalized previous search term', () => {
  const commands = [
    { id: '1', label: 'Farkaš', usage: 0 },
    { id: '2', label: 'Feature Flags', usage: 0 },
  ];
  const previousResults = [commands[0]];

  const result = filterCommandsBySearchTerm({
    uf: createUfuzzy(),
    commands,
    previousResults,
    searchTerm: 'farkas',
    previousSearchTerm: 'fár',
  });

  assert.deepEqual(result, [
    { ...commands[0], matchRanges: [{ start: 0, end: 6 }] },
  ]);
});

test('empty search restores the full command list for non-search mode', () => {
  const commands = [
    { id: '1', label: 'Farkaš', usage: 0 },
    { id: '2', label: 'Search > Example', usage: 0 },
  ];

  const result = filterCommandsBySearchTerm({
    uf: createUfuzzy(),
    commands,
    previousResults: [commands[0]],
    searchTerm: '',
    previousSearchTerm: 'farkas',
  });

  assert.deepEqual(
    result,
    commands.map((command) => ({ ...command, matchRanges: [] }))
  );
});

test('empty search returns transient descriptors without stale match ranges', () => {
  const commands = [{ id: '1', label: 'Farkaš', usage: 0 }];

  const result = filterCommandsBySearchTerm({
    uf: createUfuzzy(),
    commands,
    previousResults: [{ ...commands[0], matchRanges: [{ start: 0, end: 6 }] }],
    searchTerm: '',
    previousSearchTerm: 'farkas',
  });

  assert.deepEqual(result, [{ ...commands[0], matchRanges: [] }]);
  assert.equal('matchRanges' in commands[0], false);
});

test('no-info uFuzzy fallback returns descriptors with cleared match ranges', () => {
  const commands = [{ id: '1', label: 'Farkaš', usage: 0 }];
  const uf = {
    search() {
      return [[0], null, null];
    },
  };

  const result = filterCommandsBySearchTerm({
    uf,
    commands,
    previousResults: [{ ...commands[0], matchRanges: [{ start: 0, end: 6 }] }],
    searchTerm: 'far',
    previousSearchTerm: '',
  });

  assert.deepEqual(result, [{ ...commands[0], matchRanges: [] }]);
  assert.equal('matchRanges' in commands[0], false);
});
