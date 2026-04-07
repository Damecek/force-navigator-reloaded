import test from 'node:test';
import assert from 'node:assert/strict';
import uFuzzy from '@leeoniya/ufuzzy';
import {
  filterCommandsBySearchTerm,
  normalizeSearchValue,
} from '../src/lwc/modules/content/x/commandPalette/searchMatching.js';

function createUfuzzy() {
  return new uFuzzy({ intraMode: 1, intraSub: 0, intraDel: 0 });
}

test('normalizeSearchValue strips Latin diacritics for matching', () => {
  assert.equal(normalizeSearchValue('Farkaš'), 'farkas');
  assert.equal(normalizeSearchValue('Lukáš Zářecký'), 'lukas zarecky');
  assert.equal(normalizeSearchValue('Žluťoučký kůň'), 'zlutoucky kun');
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

  assert.deepEqual(result, commands);
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

  assert.deepEqual(result, commands);
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

  assert.deepEqual(result, commands);
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

  assert.deepEqual(result, [commands[0]]);
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

  assert.deepEqual(result, previousResults);
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

  assert.deepEqual(result, commands);
});
