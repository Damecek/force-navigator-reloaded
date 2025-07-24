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
- [ ] visualize the user running process, e.g. on command refresh, either spinner or toast or some other indication that
      task started and finished
- [ ] improve error handling when connection have expired token. implement client class which will create connection and
      expose command creator methods, on 401, it will call ensure token

> CommandRegister: failed to fetch flow commands for carvago--devas.sandbox.lightning.force.com Error: Salesforce GET
>
> /tooling/query/?q=SELECT%20ActiveVersionId%2C%20Id%2C%20LatestVersionId%2C%20LatestVersion.MasterLabel%20FROM%20FlowDefinition →
> 401: [{"message":"This session is not valid for use with the REST API","errorCode":"INVALID_SESSION_ID"}]

- [ ] fix navigation to events **r and other sobjects which cannot be opened in Lightning
      lightning/o/et4ae5**JB_Flow_Event\_\_e/list
