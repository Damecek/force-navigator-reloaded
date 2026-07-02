# Lightning App Preserve Page Design

## Goal

When a user invokes an existing `Lightning App > ...` command from a normal
Lightning workspace page, the extension should switch to the selected app while
keeping the user on the same page.

## Scope

Preserve only regular Lightning workspace locations:

- `/lightning/o/`
- `/lightning/r/`
- `/lightning/page/`

Setup, builder, auth, and other paths keep the existing behavior and navigate to
the selected app home.

## Approach

Use Salesforce's documented app URL shape:

```text
/lightning/app/{appTarget}{currentPagePath}
```

The command registry already builds app targets from `AppDefinition`. It should
continue to create the same command source, but include the app target as command
metadata so execution can build the final URL from the current browser location.

`NavigationCommand` remains responsible for command execution. If a command has
an app target, it composes a path at execution time:

- supported current path: `/lightning/app/<target><pathname><search><hash>`
- unsupported current path: `/lightning/app/<target>`

General navigation commands keep their existing static `path` behavior.

## Rejected Option

Do not use `history.back()` after landing in the app. It depends on browser
history state and Lightning router timing, and it is harder to validate
deterministically.

## Testing

Add focused unit coverage for URL composition:

- preserves object/list/record/standard page paths
- includes query string and hash
- falls back to app home for unsupported paths
- leaves non-app navigation command behavior unchanged

Run lint and the development build after implementation.
