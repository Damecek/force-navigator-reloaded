#!/usr/bin/env node

const { execute } = await import('@oclif/core');
await execute({ dir: import.meta.url });
