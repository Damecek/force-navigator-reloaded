# Welcome Screenshot Copy Design

## Goal

Remove the author-facing screenshot placeholder instruction from the installed extension's welcome page and replace it with concise, user-facing copy.

## Scope

- Rename the `Screenshots` section to `See it in action`.
- Replace the placeholder instruction with: `A closer look at the command palette, settings, and extension shortcuts.`
- Preserve the existing layout, screenshots, captions, interactions, and dark-mode styling.
- Keep screenshot pixels unchanged when Chrome renders the surrounding page in dark mode.

## Verification

- Build the extension with `npm run dev-build`.
- Confirm the new heading and description render in the welcome page in light and dark mode.
- Confirm Chrome does not auto-darken the product screenshots in dark mode.
- Confirm the old placeholder instruction no longer appears in source or build output.
- Run the relevant lint and formatting checks.
