import {
  buildLightningUrl,
  isContentScriptAllowedDomain,
  toCoreHostname,
  toLightningHostname,
  toLightningUrl,
} from '../src/background/urlUtils.js';
import {
  PERSONAL_SETTING_SETUP_NODE,
  SERVICE_SETUP_SETUP_NODE,
  SETUP_SETUP_NODE,
} from '../src/background/constants.js';

describe('urlUtils', () => {
  test('toLightningHostname converts core hosts', () => {
    expect(toLightningHostname('myorg.my.salesforce.com')).toBe(
      'myorg.lightning.force.com'
    );
  });

  test('toLightningUrl converts core hosts', () => {
    expect(toLightningUrl('myorg.my.salesforce.com')).toBe(
      'https://myorg.lightning.force.com'
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

  test("toCoreHostname won't converts non-salesforce hosts", () => {
    console.warn = jest.fn();
    expect(toCoreHostname('asd.example.com')).toBe('asd.example.com');
    expect(console.warn).toHaveBeenCalled();
  });

  test('isContentScriptAllowedDomain returns true for force.com', () => {
    expect(
      isContentScriptAllowedDomain('https://foo.lightning.force.com')
    ).toBe(true);
  });

  test('isContentScriptAllowedDomain returns false for other hosts', () => {
    expect(isContentScriptAllowedDomain('https://example.com')).toBe(false);
  });

  test('isContentScriptAllowedDomain handles error', () => {
    expect(isContentScriptAllowedDomain(null)).toBe(false);
  });

  test('buildLightningUrl handles setup nodes', () => {
    expect(buildLightningUrl('Setup.MyNode', SETUP_SETUP_NODE)).toBe(
      '/lightning/setup/MyNode/home?setupApp=all&SetupDomainProbePassed=true'
    );
    expect(buildLightningUrl('Settings.Ui', PERSONAL_SETTING_SETUP_NODE)).toBe(
      '/lightning/settings/personal/Ui/home'
    );
    expect(buildLightningUrl('Setup.Service', SERVICE_SETUP_SETUP_NODE)).toBe(
      '/lightning/setup/Service/home?setupApp=service&amp;SetupDomainProbePassed=true'
    );
    try {
      buildLightningUrl('Unknown.Node', 'unknown');
      fail('Expected error');
    } catch (error) {
      expect(error.message).toBe('Unknown node type: unknown');
    }
  });
});
