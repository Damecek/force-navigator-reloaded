const lwcConfig = require('@salesforce/eslint-config-lwc');
const lwcPlatform = require('@lwc/eslint-plugin-lwc-platform');

module.exports = [
  ...lwcConfig.configs.base,
  ...lwcPlatform.configs.recommended,
  ...lwcPlatform.configs.style,
];