import assert from 'node:assert/strict';
import { stripVTControlCharacters } from 'node:util';
import test from 'node:test';
import stringWidth from 'string-width';
import { createPaletteTable } from '../src/services/paletteTable.js';

const plain = stripVTControlCharacters;
const commands = [
  { label: 'Home', source: 'static', usage: 3 },
  {
    label: 'Administration > Users > Cassie Vondrová',
    source: 'users',
    usage: 127,
  },
  { label: '中文 👩‍💻 e\u0301', source: 'setup', usage: 0 },
];

test('palette columns align Unicode labels, sources and right-aligned usage', () => {
  const table = createPaletteTable(commands, 80);
  const header = plain(table.header);
  for (const command of commands) {
    const line = `  ${plain(table.row(command))}`;
    assert.equal(stringWidth(line), 80);
    assert.equal(
      stringWidth(line.slice(0, line.indexOf(command.source))),
      header.indexOf('Source')
    );
    assert.ok(line.endsWith(String(command.usage)));
  }
  assert.ok(header.endsWith('Uses'));
});

test('long labels truncate before metadata and preserve complete highlighted graphemes', () => {
  const command = {
    label: '中文👩‍💻e\u0301'.repeat(10),
    source: 'setup',
    usage: 23,
    matchRanges: [{ start: 0, end: 999 }],
  };
  const table = createPaletteTable(
    [command],
    40,
    (text) => `\x1b[1m${text}\x1b[22m`
  );
  const row = table.row(command);
  assert.ok(row.includes('\x1b[1m'));
  assert.ok(plain(row).includes('中文👩‍💻e\u0301中文👩‍💻e\u0301'));
  assert.match(plain(row), /…\s+setup\s+23$/);
  assert.equal(stringWidth(row), 38);
});

test('narrow terminals progressively omit metadata without wrapping rows', () => {
  for (const columns of [10, 20, 30, 40, 60, 120]) {
    const table = createPaletteTable(commands, columns);
    assert.equal(stringWidth(table.header), columns);
    for (const command of commands) {
      assert.equal(stringWidth(table.row(command)) + 2, columns);
    }
  }
  assert.ok(!plain(createPaletteTable(commands, 20).header).includes('Source'));
  assert.ok(plain(createPaletteTable(commands, 20).header).includes('Uses'));
  assert.ok(!plain(createPaletteTable(commands, 10).header).includes('Uses'));
});

test('missing metadata uses dash and zero and terminal controls cannot create rows', () => {
  const table = createPaletteTable([], 40);
  assert.match(plain(table.row({ label: 'Search > Acme' })), /-\s+0$/);
  const row = table.row({ label: 'Hi\n\t\x1b[31mBye', source: 'a\rb' });
  assert.equal(row.includes('\n'), false);
  assert.equal(row.includes('\t'), false);
  assert.equal(row.includes('\x1b[31m'), false);
  assert.equal(stringWidth(row), 38);
});
