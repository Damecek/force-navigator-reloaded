import { expect, type Page } from '@playwright/test';
import type { NavigationCommand } from './cli.js';

const ERROR_URL =
  /(?:\/login|\/error|\/invalidSession|\/secur\/frontdoor\.jsp)/i;
const ERROR_TEXT =
  /(?:URL No Longer Exists|Page Not Available|We can't find the page|Problem Loading Page|Invalid Page Redirection|Insufficient Privileges|You (?:do not|don't) have (?:access|the right permissions)|feature (?:is not|isn't) enabled)/i;

async function relevantFrameText(
  page: Page,
  commandId: string
): Promise<string> {
  const texts = await Promise.all(
    page.frames().map(async (frame, index) => {
      try {
        const includeHeader =
          commandId.startsWith('lightning-app-') ||
          commandId.startsWith('experience-site-');
        const selector =
          index === 0 &&
          (page.url().includes('/ApexCSIPage') ||
            commandId.startsWith('experience-site-') ||
            commandId.startsWith('lightning-app-') ||
            commandId === 'flow-trigger-explorer' ||
            commandId === 'agentforce-vibes' ||
            commandId === 'app-home')
            ? 'body'
            : index === 0
              ? `main, [role="main"], [role="dialog"], .oneAlohaPage${includeHeader ? ', [role="banner"], header' : ''}`
              : 'body';
        return await frame
          .locator(selector)
          .allInnerTexts()
          .then((values) => values.join('\n'));
      } catch {
        return '';
      }
    })
  );
  return texts.join('\n');
}

function normalizeUrl(value: string): string {
  try {
    return decodeURIComponent(value).replaceAll('&amp;', '&');
  } catch {
    return value.replaceAll('&amp;', '&');
  }
}

function hasExpectedRoute(
  actualUrls: string[],
  expectedUrl: URL,
  commandId: string
): boolean {
  const expectedPath = normalizeUrl(expectedUrl.pathname);
  const identityParams = ['address', 'flowId', 'networkId', 'siteId'];
  return actualUrls.some((actualValue) => {
    const actual = new URL(actualValue);
    const actualPath = normalizeUrl(actual.pathname);
    const address = expectedUrl.searchParams.get('address');
    const addressPath = address
      ? new URL(address, expectedUrl.origin).pathname
      : undefined;
    const objectListAlias =
      commandId.startsWith('sobject-list-') &&
      expectedPath.endsWith('/home') &&
      actualPath === `${expectedPath.slice(0, -'/home'.length)}/list`;
    if (
      actualPath !== expectedPath &&
      actualPath !== addressPath &&
      !objectListAlias
    ) {
      return false;
    }
    const sameOrg =
      actual.hostname.split('.')[0] === expectedUrl.hostname.split('.')[0];
    if (!sameOrg) return false;
    if (actualPath === addressPath || objectListAlias) {
      return true;
    }
    return identityParams.every((name) => {
      const expected = expectedUrl.searchParams.get(name);
      return expected === null || actual.searchParams.get(name) === expected;
    });
  });
}

function hasExpectedFinalSurface(
  pageUrl: string,
  commandId: string,
  expectedUrl: URL
): boolean {
  const current = new URL(pageUrl);
  if (commandId.startsWith('lightning-app-')) {
    return (
      current.hostname.split('.')[0] === expectedUrl.hostname.split('.')[0] &&
      current.pathname.startsWith('/lightning/')
    );
  }
  if (commandId.startsWith('experience-site-builder-')) {
    return current.hostname.endsWith('.builder.salesforce-experience.com');
  }
  if (commandId.startsWith('experience-site-workspace-')) {
    return current.href.includes('communitySetup');
  }
  if (commandId === 'agentforce-vibes') {
    const remainsOnLaunchPage =
      current.hostname.split('.')[0] === expectedUrl.hostname.split('.')[0] &&
      current.pathname === expectedUrl.pathname;
    const reachedIde =
      current.hostname.endsWith('.code-builder.platform.salesforce.com') &&
      current.pathname === '/';
    return remainsOnLaunchPage || reachedIde;
  }
  return true;
}

/** Assert both successful routing and visible page identity, including embedded legacy pages. */
export async function expectSalesforcePage(
  page: Page,
  command: NavigationCommand,
  identityGroups: string[][],
  navigationUrls: string[] = []
): Promise<void> {
  const expectedUrl = new URL(command.url);
  await expect
    .poll(
      async () => {
        const text = await relevantFrameText(page, command.id);
        const currentUrls = [
          page.url(),
          ...page.frames().map((frame) => frame.url()),
        ];
        const usesRedirectHistory =
          command.id.startsWith('lightning-app-') ||
          command.id.startsWith('experience-site-') ||
          command.id === 'agentforce-vibes';
        const urls = (
          usesRedirectHistory ? currentUrls.concat(navigationUrls) : currentUrls
        ).filter((url) => url.startsWith('http'));
        const normalizedText = text.toLocaleLowerCase('en-US');
        return {
          route: hasExpectedRoute(urls, expectedUrl, command.id),
          surface: hasExpectedFinalSurface(page.url(), command.id, expectedUrl),
          errorRoute: ERROR_URL.test(page.url()),
          errorText: ERROR_TEXT.test(text),
          readable: text.trim().length > 20,
          identity: identityGroups.every((group) =>
            group.some((candidate) =>
              normalizedText.includes(candidate.toLocaleLowerCase('en-US'))
            )
          ),
        };
      },
      {
        message: `${command.id} did not reach its expected route and visible main-content identity`,
        timeout: 45_000,
        intervals: [500, 1_000, 2_000, 3_000],
      }
    )
    .toEqual({
      route: true,
      surface: true,
      errorRoute: false,
      errorText: false,
      readable: true,
      identity: true,
    });
}
