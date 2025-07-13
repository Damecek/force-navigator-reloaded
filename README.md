# Force Navigator Reloaded

<p align="center">
  <img src="web/icon-light.svg" alt="Logo"/>
</p>

## Overview

Force Navigator Reloaded is a Chrome Extension for Salesforce Lightning that provides fast and efficient navigation
within Salesforce environments. This extension implements a command palette interface that allows users to quickly
search, navigate, and perform actions without leaving their keyboard. It is available directly from the
[Chrome Web Store](https://chromewebstore.google.com/detail/iniflnopffblekndhplennjijdcfkeak?utm_source=github).

## Features

- **Command Palette**: Access a powerful command interface with keyboard shortcut (Ctrl+Shift+L on Windows or Cmd+Shift+P on Mac),
  this can be configured in the chrome shortcut settings (`chrome://extensions/shortcuts`)
- **Fast Navigation**: Quickly search and navigate to Salesforce records, flows, list views, and setup pages
- **SLDS Integration**: Uses Salesforce Lightning Design System for a native look and feel
- **Modern Architecture**: Built with [LWC OSS](https://lwc.dev/) (Lightning Web Components) for composable UI
- **Dynamic & Configurable Commands**: Fetches and caches Salesforce setup menu items, SObjects, and Flows directly from
  your org. Edit the JSON settings to include or exclude specific sources and custom commands from the palette.
- **Command-Controlled Palette Closing**: Commands can keep the palette open after execution when appropriate
- **Virtual Scrolling**: Only visible commands are rendered, keeping performance high even with thousands of commands
- **Usage-based Sorting**: Frequently executed commands appear higher in search results

### Fuzzy Search

The command palette uses the [uFuzzy](https://github.com/leeoniya/uFuzzy) library for efficient searching.

## Installation

### From Chrome Web Store

You can install the latest published version directly from
the [Chrome Web Store](https://chromewebstore.google.com/detail/iniflnopffblekndhplennjijdcfkeak?utm_source=github).
Please note that updates are published manually, and due to the review process—which can take several days—the store
version might occasionally lag behind the latest release.

### Manual Installation (Developer Mode)

1. Download `force-navigator-reloaded.zip` from the [GitHub Releases page](https://github.com/Damecek/force-navigator-reloaded/releases)
2. Extract the archive
3. Open Chrome and navigate to `chrome://extensions`
4. Enable **Developer mode** in the top-right corner
5. Click **Load unpacked** and select the extracted folder

## Usage

1. Navigate to any Salesforce Lightning page
2. Press `Ctrl+Shift+L` (or `Cmd+Shift+P` on Mac) to toggle the command palette
3. Type commands or search terms to find what you need
4. Press Enter to execute the selected command
5. Press `Esc` or the same shortcut again to close the command palette
6. Open the extension popup from the toolbar icon for quick help and a link to Settings
7. Use the Settings page to edit the JSON configuration, tailoring which command sources (Setup nodes, objects, flows, custom commands) appear in the palette

### Supported Domains

- _\*.force.com\*_
- _\*.salesforce-setup.com\*_
- _\*.builder.salesforce-experience.com\*_

## Authentication & Connected Apps

Force Navigator Reloaded authorises to Salesforce via the **OAuth 2.0 PKCE** flow declared in `src/manifest.json`.

### Where do the connected apps live?

- Two connected-app definitions live in `sf/force-app/main/default/connectedApps`:
  - `Force_Navigator_Reloaded_Prod.connectedApp-meta.xml`
  - `Force_Navigator_Reloaded_Dev.connectedApp-meta.xml`
- Both apps were **created and configured once** in the author’s developer org.  
  They are bound to the stable extension IDs:
  - Production ID `iniflnopffblekndhplennjijdcfkeak`
  - Development ID `fjcokiadigpmkojdlhbkbhimkcmjokon`

### Do I have to deploy the connected app to my org?

**No.** The connected app is needed only during the OAuth handshake; it is _not_ deployed to, nor stored in, your
Salesforce org. Simply install the extension and approve its access once—nothing else is required.

Even if the original developer org is deleted, Salesforce retains the connected-app metadata in its infrastructure. At
that point the app becomes read-only. Any future changes (e.g. redirect URIs, scopes, secret rotation) would require the
author to redeploy a fresh connected app and update the extension’s consumer key—end-users do **not** need to take
action.

## Development

### Local Setup

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run dev` to build the extension in watch mode
4. Open Chrome and navigate to `chrome://extensions/`
5. Enable **Developer mode** and load the `dist` directory as an unpacked extension

### Project Structure

- **Background Script** (`src/background`): Service worker that manages extension lifecycle, listens for keyboard
  commands, and handles cross-context communication
- **Content Script** (`src/content_scripts`): Injects the LWC app into Salesforce pages and handles communication with
  the background script
- **LWC Components** (`src/content_scripts/modules/x`): Lightning Web Components that provide the UI for the command
  palette
- **Popup** (`src/popup`): Provides quick usage tips and links to settings and GitHub, with automatic light/dark theme
  styling
- **Options Page** (`src/options` and `src/options/modules`): Settings UI built with LWC
- **Shared Utilities** (`src/shared`): Common modules for background and content scripts, including the Channel messaging wrapper and settings management

### Build & Toolchain

- **Webpack + Babel**: Builds and bundles the extension into `dist/`
- **LWC**: Uses Lightning Web Components via lwc-webpack-plugin
- **Code Quality**: Prettier and ESLint configured with Salesforce LWC standards
- **Git Hooks**: Husky pre-commit hook runs formatting
- **CI Build & Web Store Release**: A GitHub Action builds `dist/` on each commit to `main` where the source files has changed, attaches a zipped archive to the latest GitHub release, and uploads the extension to the Chrome Web Store
- **Manifest Key Injection**: `webpack` injects the extension `key` and OAuth consumer key based on build mode. This keeps the extension ID stable for authentication.

### Available Scripts

- `npm run build`: Build the extension for production
- `npm run dev`: Build with watch mode for development
- `npm run lint`: Run ESLint on source files
- `npm run lint-fix`: Fix ESLint issues automatically
- `npm run format`: Format code with Prettier
- `npm run bump`: Increment minor version and sync to `src/manifest.json`

Connected apps are configured for a specific extension ID. Same app is reused across any Salesforce org without actual
deployment, even if the org where the app lived is deleted.

## Roadmap

See [backlog.md](backlog.md) for planned features and development tasks.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

If you enjoy using Force Navigator Reloaded, please consider leaving a
[review on the Chrome Web Store](https://chromewebstore.google.com/detail/force-navigator-reloaded/iniflnopffblekndhplennjijdcfkeak/reviews?utm_source=github).
Your feedback helps the project grow.

## License

[MIT License](http://en.wikipedia.org/wiki/MIT_License)

## Privacy Policy

This extension only runs locally in communication with your instance of Salesforce. No data is collected from any user, nor is extension activity tracked or reported to a third-party.

## Terms of Service

This extension is not intended to support the work of any individual or organization that is discriminatory or outright illegal.
