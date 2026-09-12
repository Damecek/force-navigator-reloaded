import { Org } from '@salesforce/core';
import { expect, test } from '@playwright/test';
import { openNavigation } from '../lib/services/navigation.js';
import { resolveOpen, searchCommands, type NavigationCommand } from './cli.js';
import { navigationMatrix } from './navigation-matrix.js';
import { expectSalesforcePage } from './page-identity.js';

const targetOrgs = (process.env.SF_NAVIGATOR_E2E_ORGS ?? '')
  .split(',')
  .map((alias) => alias.trim())
  .filter(Boolean);
const unavailableCommandIds = new Set(
  (process.env.SF_NAVIGATOR_E2E_UNAVAILABLE ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
);

if (targetOrgs.length === 0) {
  throw new Error(
    'Set SF_NAVIGATOR_E2E_ORGS to one or more explicitly approved, comma-separated org aliases'
  );
}

for (const targetOrg of targetOrgs) {
  test.describe(`navigator open in ${targetOrg}`, () => {
    let catalog: NavigationCommand[];
    let org: Org;

    test.beforeAll(async () => {
      [catalog, org] = await Promise.all([
        searchCommands(targetOrg),
        Org.create({ aliasOrUsername: targetOrg }),
      ]);
      expect(catalog.length).toBeGreaterThan(0);
    });

    test('catalog contains only classified navigation commands', () => {
      const unmatched = catalog.filter(
        (command) =>
          !navigationMatrix.some((navigationCase) =>
            navigationCase.id.test(command.id)
          )
      );
      expect(unmatched.map(({ id }) => id)).toEqual([]);
    });

    for (const navigationCase of navigationMatrix) {
      test(navigationCase.name, async ({ page }) => {
        const navigationUrls: string[] = [];
        page.on('request', (request) => {
          if (request.isNavigationRequest()) navigationUrls.push(request.url());
        });
        const candidates = catalog.filter((candidate) =>
          navigationCase.id.test(candidate.id)
        );
        const customObjectLabels = new Set(
          catalog
            .filter((candidate) => /^sobject-new-.*__c$/.test(candidate.id))
            .map((candidate) => candidate.label.split('>').at(-2)?.trim())
        );
        const customObject = (candidate: NavigationCommand) => {
          const objectLabel = candidate.label.split('>').at(-2)?.trim();
          return (
            candidate.id.includes('__c') || customObjectLabels.has(objectLabel)
          );
        };
        const preferredStandardApp =
          navigationCase.name === 'Standard Lightning app'
            ? candidates.find(
                (candidate) =>
                  candidate.id === 'lightning-app-standard__LightningService'
              )
            : undefined;
        const catalogCommand =
          preferredStandardApp ??
          (navigationCase.objectVariant === 'custom'
            ? candidates.find(customObject)
            : (candidates.find(
                (candidate) =>
                  candidate.id.includes('Account') ||
                  candidate.label.includes('Account')
              ) ??
              candidates.find((candidate) => !customObject(candidate)) ??
              candidates[0]));
        test.skip(
          !catalogCommand,
          `org exposes no ${navigationCase.name} command`
        );

        const resolved = await resolveOpen(targetOrg, catalogCommand!.id);
        expect(resolved.opened).toBe(false);
        expect(resolved.command.id).toBe(catalogCommand!.id);
        expect(resolved.command.path).toBe(catalogCommand!.path);
        expect(resolved.url).toBe(catalogCommand!.url);

        const destination = new URL(resolved.url);
        const instance = new URL(org.getConnection().instanceUrl);
        expect(destination.protocol).toBe('https:');
        expect(destination.hostname).toMatch(
          /(?:\.my\.salesforce\.com|\.lightning\.force\.com|\.my\.salesforce-setup\.com)$/
        );
        expect(destination.hostname.split('.')[0]).toBe(
          instance.hostname.split('.')[0]
        );
        test.skip(
          unavailableCommandIds.has(resolved.command.id),
          `${resolved.command.id} was explicitly marked unavailable for this validation run`
        );

        try {
          await openNavigation({
            org,
            command: resolved.command,
            opener: async (authenticatedUrl) => {
              await page.goto(authenticatedUrl, {
                waitUntil: 'domcontentloaded',
              });
            },
          });
        } catch {
          throw new Error(
            `${catalogCommand!.id} failed during authenticated browser navigation`
          );
        }
        await expectSalesforcePage(
          page,
          resolved.command,
          navigationCase.dom(resolved.command),
          navigationUrls
        );
      });
    }
  });
}
