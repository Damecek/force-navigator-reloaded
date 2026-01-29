# MVP Backlog

Below are the main steps to achieve the MVP of the Command Palette for the Salesforce extension.  
Mark each line with [x] when the task is completed.

- [ ] Error Handling: centralized input validation and error reporting in the UI
- [ ] Command `Login as <username>` (User Switcher)
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

another example of such is `New Report`

```json
{
  "componentDef": "reports:reportBuilder",
  "attributes": { "recordId": "", "newReportBuilder": true },
  "state": {}
}
```

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

- [ ] handle limit reached
      CommandRegister: failed to fetch dynamic commands for carvago6-dev-ed.develop.lightning.force.com Error: Salesforce
      GET
      /tooling/query/?q=SELECT%20FullName%2C%20NodeType%2C%20Label%2C%20Url%0A%20%20%20%20FROM%20SetupNode%0A%20%20%20%20WHERE%20NodeType%20IN%20('
      Setup'%2C'PersonalSettings') → 403: [{"message":"TotalRequests Limit exceeded.","errorCode":"REQUEST_LIMIT_EXCEEDED"}]
      Context background.js:513 (anonymous function)
- [ ] automatically refresh specific metadata on specific pages, e.g. when creating new object/field, when creating new
      flow version etc.
