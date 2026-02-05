<!--
  AGENTS.md
  This file provides instructions for AI agents working in this repository.
-->

# Instructions

- The user will provide a task.
- Wait for all terminal commands to be completed (or terminate them) before finishing.
- When adding new command sources, update the related constants, default settings, README.md, and backlog.md.
- When running a development build during agent work, use `npm run dev-build` unless the task explicitly requires watch
  mode.

# AGENTS.md spec

- Containers often contain AGENTS.md files. These files can appear anywhere in the container's filesystem. Typical
  locations include `/`, `~`, and in various places inside of Git repos.
- These files are a way for humans to give you (the agent) instructions or tips for working within the container.
- Some examples might be: coding conventions, info about how code is organized, or instructions for how to run or test
  code.
- AGENTS.md files may provide instructions about PR messages (messages attached to a GitHub Pull Request produced by the
  agent, describing the PR). These instructions should be respected.
- Instructions in AGENTS.md files:
  - The scope of an AGENTS.md file is the entire directory tree rooted at the folder that contains it.
  - For every file you touch in the final patch, you must obey instructions in any AGENTS.md file whose scope includes
    that file.
  - Instructions about code style, structure, naming, etc. apply only to code within the AGENTS.md file's scope,
    unless the file states otherwise.
  - More-deeply-nested AGENTS.md files take precedence in the case of conflicting instructions.
  - Direct system/developer/user instructions (as part of a prompt) take precedence over AGENTS.md instructions.
- AGENTS.md files need not live only in Git repos. For example, you may find one in your home directory.
- If the AGENTS.md includes programmatic checks to verify your work, you MUST run all of them and make a best effort to
  validate that the checks pass AFTER all code changes have been made.
  - This applies even for changes that appear simple, i.e. documentation. You still must run all of the programmatic
    checks.

# Modularity Preference

- Follow a modular structure: separate distinct responsibilities into individual files.
  - Initialization logic, event listeners, and business logic should each reside in their own modules.
  - For example, in `src/content_scripts`, `content.js` mounts the LWC app.
  - In `src/background`, `index.js` delegates command handling to `commandListener.js`.
  - When adding new features, maintain this pattern to ensure clarity, testability, and ease of maintenance.
- Prefer using ES6 modules (`import`/`export`) over CommonJS (`require`) for modularity.
- Prefer using async/await to .then().catch() to callbacks for async operations.
- Update markdown documents as part of your work.
  - AGENTS.md contains instructions for AI agents working in this repository. Add or update instructions as repeated
    patterns are discovered.
  - README.md describes the project and its features.
  - backlog.md lists planned features and development tasks. Mark completed tasks with an x once done.
- Use JSDoc comments to document public APIs and to introduce types for parameters and return values.
- Do not litter code with comments //.
- Use `console.log` for debugging; logs are stripped in production builds, so avoid excessive or obsolete statements.
- For long-running command executions, emit explicit loading events from command classes so `app` can toggle loading indicators without command-id filtering.
