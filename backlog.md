# MVP Backlog

Below are the main steps to achieve the MVP of the Command Palette for the Salesforce extension.  
Mark each line with [x] when the task is completed.

- [ ] Error Handling: centralized input validation and error reporting in the UI
- [ ] Command `Login as <username>` (User Switcher)
- [ ] Add a list of active flows to the menu
- [ ] Add SObject-specific submenu (fields, layout, etc.)
- [ ] Settings Provider and UI for user preferences (theme, keyboard shortcuts)
- [ ] Theme Engine with support for themes (Default, Dark, Unicorn, Solarized)
- [ ] Implement Lightning navigation instead of page redirection refer to https://github.com/tprouvot/Salesforce-Inspector-reloaded/blob/main/addon/inject.js
- [ ] Try implementing a wire adapter for the command list https://lwc.dev/guide/wire_adapter#wire-adapters
- [ ] Implement record search using `?` prefix
- [ ] Implement Setup Page
- [ ] Brand the Auth Page
- [ ] Consider deferring opening of the Auth Page until user requests it; e.g., if there’s no token, the only available command is `authorize`
- [x] Modernize icons
