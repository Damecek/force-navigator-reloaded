# Force Navigator Reloaded Options JSON Reference

This document explains each key in the Settings JSON shown on the extension options page.

`AutoLogin`: Enables optional My Domain auto-login on supported Salesforce login pages for already authorized orgs. Default: `false`.

`Commands`: Root object for command-source visibility toggles.

`Commands.SetupBased`: Controls Setup menu command groups.

`Commands.SetupBased.Setup`: Includes standard Setup navigation commands. Default: `true`.

`Commands.SetupBased.PersonalSettings`: Includes Personal Settings navigation commands. Default: `true`.

`Commands.SetupBased.ServiceSetup`: Includes Service Setup navigation commands. Default: `false`.

`Commands.EntityDefinition`: Controls metadata/object-related command groups.

`Commands.EntityDefinition.CustomMetadata`: Includes custom metadata type commands. Default: `true`.

`Commands.EntityDefinition.SObjectEntityType`: Controls SObject-related sub-groups.

`Commands.EntityDefinition.SObjectEntityType.SObjectFieldsAndRelationships`: Includes object fields and relationships commands. Default: `true`.

`Commands.EntityDefinition.SObjectEntityType.PageLayouts`: Includes object page layout commands. Default: `false`.

`Commands.EntityDefinition.SObjectEntityType.LightningPages`: Includes object Lightning page commands. Default: `true`.

`Commands.EntityDefinition.SObjectEntityType.ButtonsLinksActions`: Includes object buttons, links, and actions commands. Default: `true`.

`Commands.EntityDefinition.SObjectEntityType.CompactLayouts`: Includes object compact layout commands. Default: `false`.

`Commands.EntityDefinition.SObjectEntityType.FieldSets`: Includes object field set commands. Default: `false`.

`Commands.EntityDefinition.SObjectEntityType.Limits`: Includes object limit commands. Default: `false`.

`Commands.EntityDefinition.SObjectEntityType.RecordTypes`: Includes object record type commands. Default: `true`.

`Commands.EntityDefinition.SObjectEntityType.RelatedLookupFilters`: Includes object related lookup filter commands. Default: `false`.

`Commands.EntityDefinition.SObjectEntityType.MySearchLayouts`: Includes object search layout commands. Default: `false`.

`Commands.EntityDefinition.SObjectEntityType.ObjectAccess`: Includes object access commands. Default: `false`.

`Commands.EntityDefinition.SObjectEntityType.ApexTriggers`: Includes object Apex trigger commands. Default: `true`.

`Commands.EntityDefinition.SObjectEntityType.FlowTriggers`: Includes object flow trigger commands. Default: `true`.

`Commands.EntityDefinition.SObjectEntityType.ValidationRules`: Includes object validation rule commands. Default: `true`.

`Commands.FlowDefinition`: Controls flow-related command groups.

`Commands.FlowDefinition.Definition`: Includes flow definition commands. Default: `true`.

`Commands.FlowDefinition.Latest`: Includes commands for latest flow version. Default: `true`.

`Commands.FlowDefinition.Active`: Includes commands for active flow version. Default: `false`.

`Commands.LightningApplication`: Includes Lightning app navigation commands. Default: `true`.

`Commands.PermissionSet`: Includes Permission Set commands. Default: `true`.

`Commands.PermissionSetGroup`: Includes Permission Set Group commands. Default: `true`.
