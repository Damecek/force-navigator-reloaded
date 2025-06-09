# Force Navigator Reloaded

<p align="center">
  <img src="web/icon-light.svg" alt="Logo"/>
</p>

## Overview

Force Navigator Reloaded is a Chrome Extension for Salesforce Lightning that provides fast and efficient navigation
within Salesforce environments. This extension implements a command palette interface that allows users to quickly
search, navigate, and perform actions without leaving their keyboard.

## Features

- **Command Palette**: Access a powerful command interface with keyboard shortcut (Ctrl+Shift+P or Cmd+Shift+P on Mac)
- **Fast Navigation**: Quickly search and navigate to Salesforce records, list views, and setup pages
- **SLDS Integration**: Uses Salesforce Lightning Design System for a native look and feel
- **Modern Architecture**: Built with [LWC OSS](https://lwc.dev/) (Lightning Web Components) for composable UI
- **Dynamic Setup Menu Commands**: Fetches and caches Salesforce setup menu items directly from your org for quick access

## Installation

### From Chrome Web Store

_Coming soon_

### Manual Installation (Developer Mode)

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run build` to build the extension
4. Open Chrome and navigate to `chrome://extensions/`
5. Enable "Developer mode" in the top-right corner
6. Click "Load unpacked" and select the `dist` directory from this project

## Usage

1. Navigate to any Salesforce Lightning page
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac) to open the command palette
3. Type commands or search terms to find what you need
4. Press Enter to execute the selected command

## Development

### Project Structure

- **Background Script** (`src/background`): Service worker that manages extension lifecycle, listens for keyboard
  commands, and handles cross-context communication
- **Content Script** (`src/content_scripts`): Injects the LWC app into Salesforce pages and handles communication with
  the background script
- **LWC Components** (`src/content_scripts/modules/x`): Lightning Web Components that provide the UI for the command
  palette
- **Popup** (`src/popup.html/js`): Extension popup interface (currently a basic scaffold)

### Build & Toolchain

- **Webpack + Babel**: Builds and bundles the extension into `dist/`
- **LWC**: Uses Lightning Web Components via lwc-webpack-plugin
- **Code Quality**: Prettier and ESLint configured with Salesforce LWC standards
- **Git Hooks**: Husky pre-commit hook runs formatting
- **CI Build**: A GitHub Action builds `dist/` on each commit to main, zips it as `force-navigator-reloaded.zip`, and attaches it to the latest GitHub release
- **Manifest Key Injection**: `webpack` injects the extension `key` and OAuth consumer key based on build mode. This keeps the extension ID stable for authentication.

### Available Scripts

- `npm run build`: Build the extension for production
- `npm run dev`: Build with watch mode for development
- `npm run lint`: Run ESLint on source files
- `npm run lint-fix`: Fix ESLint issues automatically
- `npm run format`: Format code with Prettier

### Authentication Setup

Force Navigator Reloaded uses OAuth2 with PKCE to authorize against Salesforce. The Chrome OAuth settings live in `src/manifest.json`, the connected apps are located in `sf/force-app/main/default/connectedApps`, and the login logic is implemented in `src/background/auth/auth.js`.

The extension ID is stable thanks to the manifest `key` field. Production builds use ID `iniflnopffblekndhplennjijdcfkeak` while development builds use `fjcokiadigpmkojdlhbkbhimkcmjokon`.

There are two connected app definitions in `sf/force-app/main/default/connectedApps`:

- `Force_Navigator_Reloaded_Prod.connectedApp-meta.xml`
- `Force_Navigator_Reloaded_Dev.connectedApp-meta.xml`
  Use the appropriate one for your target environment.

To configure authentication for development:

1. Run `npm run dev` and load the extension from the `dist/` folder using **Load unpacked**. The extension ID will be `fjcokiadigpmkojdlhbkbhimkcmjokon`.
2. Deploy the `Force_Navigator_Reloaded_Dev` connected app with `npm --prefix sf run deploy` and retrieve it using `npm --prefix sf run retreive`. Copy the `<consumerKey>` value—deploying generates a new client ID.
3. Replace `DEV_CONSUMER_KEY` in the metadata file with this value. Webpack injects the consumer key into `manifest.json` and the `CLIENT_ID` constant automatically. Reload the extension (or rerun `npm run dev`) and run the **Authorize Extension** command from the palette to start the login flow. Tokens are cached per org and refreshed automatically.
4. For production builds use the `Force_Navigator_Reloaded_Prod` connected app and replace `PROD_CONSUMER_KEY` with its consumer key before running `npm run build`.

Once a connected app is configured for a specific extension ID you can reuse it with any Salesforce org without redeploying.

## Roadmap

See [backlog.md](backlog.md) for planned features and development tasks.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT License](http://en.wikipedia.org/wiki/MIT_License)

## Privacy Policy

This extension only runs locally in communication with your instance of Salesforce. No data is collected from any user, nor is extension activity tracked or reported to a third-party.

## Terms of Service

This extension is not intended to support the work of any individual or organization that is discriminatory or outright illegal.
