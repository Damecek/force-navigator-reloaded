import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const welcomeTemplateUrl = new URL(
  '../src/lwc/modules/welcome/x/welcomeApp/welcomeApp.html',
  import.meta.url
);
const welcomeStylesUrl = new URL('../src/welcome/welcome.css', import.meta.url);

test('welcome screenshot section uses user-facing production copy', async () => {
  const template = await readFile(welcomeTemplateUrl, 'utf8');
  const normalizedTemplate = template.replace(/\s+/g, ' ');

  assert.match(template, /title="See it in action"/);
  assert.ok(
    normalizedTemplate.includes(
      'A closer look at the command palette, settings, and extension shortcuts.'
    )
  );
  assert.doesNotMatch(template, /Drop the screenshots into the placeholders/);
});

test('welcome page leads with trying the extension in Salesforce', async () => {
  const template = await readFile(welcomeTemplateUrl, 'utf8');
  const script = await readFile(
    new URL(
      '../src/lwc/modules/welcome/x/welcomeApp/welcomeApp.js',
      import.meta.url
    ),
    'utf8'
  );

  assert.match(template, /onclick={handleTryInSalesforceClick}/);
  assert.match(template, /{primaryActionLabel}/);
  assert.match(script, /'Try it in Salesforce'/);
  assert.match(script, /'Open Salesforce'/);
  assert.match(script, /https:\/\/login\.salesforce\.com\//);
  assert.match(script, /chrome\.tabs\.query\(\{ url: LIGHTNING_URLS \}/);
  assert.match(script, /chrome\.tabs\.update\(this\.firstLightningTabId/);
  assert.match(script, /chrome\.windows\.update\(/);
});

test('welcome screenshots retain their original colors in dark mode', async () => {
  const styles = await readFile(welcomeStylesUrl, 'utf8');

  assert.match(
    styles,
    /@media \(prefers-color-scheme: dark\)[\s\S]*\.welcome-shot__image\s*{[\s\S]*color-scheme: only light;/
  );
});
