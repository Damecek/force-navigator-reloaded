import { cp, mkdir, rm } from 'node:fs/promises';

const outputRoot = new URL('../lib/', import.meta.url);
const pluginSource = new URL('../src/', import.meta.url);
const navigatorSource = new URL('../../../src/navigator/', import.meta.url);

await rm(outputRoot, { force: true, recursive: true });
await mkdir(outputRoot, { recursive: true });
await cp(pluginSource, outputRoot, { recursive: true });
await cp(navigatorSource, new URL('./core/', outputRoot), { recursive: true });
