# MVP Backlog

Below are the main steps to achieve the MVP of the Command Palette for the Salesforce extension.  
Mark each line with [x] when the task is completed.

- [ ] Error Handling: centralized input validation and error reporting in the UI
- [ ] Command `Login as <username>` (User Switcher)
- [ ] Implement Lightning navigation instead of page redirection refer
      to https://github.com/tprouvot/Salesforce-Inspector-reloaded/blob/main/addon/inject.js
- [ ] Implement record search using `?` prefix

> could be implemented encoding following json in base64 and prefixing with `one/one.app#<base64>`

```json
{
  "componentDef": "forceSearch:searchPageDesktop",
  "attributes": {
    "term": "<term>",
    "scopeMap": {
      "type": "TOP_RESULTS"
    },
    "context": {
      "FILTERS": {},
      "searchSource": "ASSISTANT_DIALOG",
      "disableIntentQuery": false,
      "disableSpellCorrection": false,
      "debugInfo": {
        "appName": "LoggerConsole",
        "appType": "Console",
        "appNamespace": "c",
        "location": "home:landing"
      }
    },
    "groupId": "DEFAULT"
  },
  "state": {}
}
```

- [x] implement command usage prioritization or better sorting based on usage
- [ ] performance: instantiate commands only on click/select in the command item class, now it is instantiated on
      command list load
- [ ] [internationalize](https://developer.chrome.com/docs/extensions/reference/api/i18n#concepts_and_usage) the
      extension
