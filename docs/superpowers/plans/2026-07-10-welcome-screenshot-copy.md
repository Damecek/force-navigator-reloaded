# Welcome Screenshot Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the author-facing screenshot placeholder instruction with production-ready welcome-page copy.

**Architecture:** Keep the existing LWC component structure and change only the screenshot section's static heading and lead text. Add a focused source-level regression test so the placeholder cannot return unnoticed.

**Tech Stack:** Lightning Web Components, HTML templates, Node.js test runner, Webpack, Chrome DevTools.

## Global Constraints

- The section title must be exactly `See it in action`.
- The section description must be exactly `A closer look at the command palette, settings, and extension shortcuts.`
- Preserve the existing layout, screenshots, captions, interactions, and dark-mode styling.
- Keep screenshot pixels unchanged when Chrome renders the surrounding page in dark mode.
- Do not modify version fields manually.

---

### Task 1: Replace and verify the screenshot-section copy

**Files:**

- Create: `tests/welcomeCopy.test.js`
- Modify: `src/lwc/modules/welcome/x/welcomeApp/welcomeApp.html`

**Interfaces:**

- Consumes: The static welcome-page LWC template.
- Produces: User-facing screenshot-section copy protected by a Node.js regression test.

- [ ] **Step 1: Write the failing source-copy test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const welcomeTemplateUrl = new URL(
  '../src/lwc/modules/welcome/x/welcomeApp/welcomeApp.html',
  import.meta.url
);

test('welcome screenshot section uses user-facing production copy', async () => {
  const template = await readFile(welcomeTemplateUrl, 'utf8');

  assert.match(template, /title="See it in action"/);
  assert.match(
    template,
    /A closer look at the command palette, settings, and extension shortcuts\./
  );
  assert.doesNotMatch(template, /Drop the screenshots into the placeholders/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `rtk node --test tests/welcomeCopy.test.js`

Expected: FAIL because the template still contains `title="Screenshots"` and the placeholder instruction.

- [ ] **Step 3: Apply the minimal template change**

```html
<x-welcome-section title="See it in action">
  <p class="slds-text-body_regular welcome-lead">
    A closer look at the command palette, settings, and extension shortcuts.
  </p></x-welcome-section
>
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `rtk node --test tests/welcomeCopy.test.js`

Expected: PASS with 1 test and 0 failures.

- [ ] **Step 5: Run repository verification**

Run: `rtk node --test tests/*.test.js`

Expected: PASS with 29 tests and 0 failures.

Run: `rtk npm run lint`

Expected: exit code 0 with no ESLint errors.

Run: `rtk npx prettier --check tests/welcomeCopy.test.js src/lwc/modules/welcome/x/welcomeApp/welcomeApp.html`

Expected: both files conform to Prettier formatting.

Run: `rtk npm run dev-build`

Expected: Webpack compiles successfully.

- [ ] **Step 6: Verify the rendered page in Chrome**

Serve `dist/` locally, open `welcome.html` with mocked extension APIs, and inspect light and dark color schemes with Chrome DevTools.

Expected: `See it in action` and the new description render in both schemes; the old placeholder instruction is absent; no new console errors are present.

### Task 2: Prevent Chrome from auto-darkening product screenshots

**Files:**

- Modify: `tests/welcomeCopy.test.js`
- Modify: `src/welcome/welcome.css`

**Interfaces:**

- Consumes: The welcome page's dark-mode media query and screenshot image class.
- Produces: Original screenshot pixels inside the existing dark-mode presentation.

- [ ] **Step 1: Add and run the failing dark-image test**

Assert that `.welcome-shot__image` declares `color-scheme: only light` inside the dark-mode media query.

Run: `rtk node --test tests/welcomeCopy.test.js`

Expected: FAIL because the opt-out declaration is absent.

- [ ] **Step 2: Add the minimal dark-image opt-out**

```css
.welcome-shot__image {
  border-color: #555;
  color-scheme: only light;
}
```

- [ ] **Step 3: Re-run focused and repository verification**

Run the focused test, all Node.js tests, ESLint, Prettier, and `npm run dev-build` as specified in Task 1.

Expected: all commands exit successfully with 30 tests and 0 failures.

- [ ] **Step 4: Re-verify dark rendering in Chrome**

Reload the locally served build without injected CSS and inspect the screenshot section in dark mode.

Expected: screenshots retain their original light UI pixels while the surrounding page remains dark.

- [ ] **Step 5: Commit the verified implementation**

```bash
git add docs/superpowers/specs/2026-07-10-welcome-screenshot-copy-design.md docs/superpowers/plans/2026-07-10-welcome-screenshot-copy.md tests/welcomeCopy.test.js src/lwc/modules/welcome/x/welcomeApp/welcomeApp.html src/welcome/welcome.css
git commit -m "fix: polish welcome screenshot presentation" -m "Co-Authored-By: codex <codex@openai.com>"
```
