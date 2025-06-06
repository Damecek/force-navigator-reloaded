import {
  toLightningHostname,
  toCoreHostname,
  isContentScriptAllowedDomain,
  buildLightningUrl,
} from '../src/background/urlUtils.js';
import {
  SETUP_SETUP_NODE,
  PERSONAL_SETTING_SETUP_NODE,
} from '../src/background/constants.js';

describe('urlUtils', () => {
  test('toLightningHostname converts core hosts', () => {
    expect(toLightningHostname('myorg.my.salesforce.com')).toBe(
      'myorg.lightning.force.com'
    );
  });

  test('toLightningHostname converts vf hosts', () => {
    expect(toLightningHostname('myorg--c.vf.force.com')).toBe(
      'myorg.lightning.force.com'
    );
  });

  test('toCoreHostname converts lightning hosts', () => {
    expect(toCoreHostname('myorg.lightning.force.com')).toBe(
      'myorg.my.salesforce.com'
    );
  });

  test('isContentScriptAllowedDomain returns true for force.com', () => {
    expect(
      isContentScriptAllowedDomain('https://foo.lightning.force.com')
    ).toBe(true);
  });

  test('isContentScriptAllowedDomain returns false for other hosts', () => {
    expect(isContentScriptAllowedDomain('https://example.com')).toBe(false);
  });

  test('buildLightningUrl handles setup nodes', () => {
    expect(buildLightningUrl('Setup.MyNode', SETUP_SETUP_NODE)).toBe(
      '/lightning/setup/MyNode/home?setupApp=all&SetupDomainProbePassed=true'
    );
    expect(buildLightningUrl('Settings.Ui', PERSONAL_SETTING_SETUP_NODE)).toBe(
      '/lightning/settings/personal/Ui/home'
    );
  });
});
