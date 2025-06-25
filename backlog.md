# MVP Backlog

Below are the main steps to achieve the MVP of the Command Palette for the Salesforce extension.  
Mark each line with [x] when the task is completed.

- [ ] Error Handling: centralized input validation and error reporting in the UI
- [ ] Command `Login as <username>` (User Switcher)
- [x] Add a list of active flows to the menu
- [ ] Add SObject-specific submenu (fields, layout, etc.)
- [ ] Settings Provider and UI for user preferences (theme, SetupNodes, custom commands, etc.)
- [ ] Theme Engine with support for themes (Default, Dark, Unicorn, Solarized)
- [ ] Implement Lightning navigation instead of page redirection refer to https://github.com/tprouvot/Salesforce-Inspector-reloaded/blob/main/addon/inject.js
- [ ] Implement record search using `?` prefix
- [x] Brand the Auth Page
- [x] Consider deferring opening of the Auth Page until user requests it; e.g., if there’s no token, the only available command is `authorize`
- [x] Modernize icons
- [x] Implement Channel messaging wrapper for chrome.runtime messages
- [ ] Replace all message string names with constants
- [ ] performance: instantiate commands only on click/select in the command item class, now it is instantiated on command list load
- [ ] [internationalize](https://developer.chrome.com/docs/extensions/reference/api/i18n#concepts_and_usage) the
      extension
- [x] create pipeline
      for [publishing to chrome store](https://github.com/marketplace/actions/publish-chrome-extension-to-chrome-web-store)
- [x] Publish initial version
      to [Chrome Web Store](https://chromewebstore.google.com/detail/iniflnopffblekndhplennjijdcfkeak?utm_source=github)
- [ ] support experience setup
      domains https://carvago--devas.sandbox.builder.salesforce-experience.com/, https://carvago.builder.salesforce-experience.com/
