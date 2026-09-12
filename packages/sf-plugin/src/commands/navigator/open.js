import { Args } from '@oclif/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import {
  createCommandContext,
  reportCatalogErrors,
} from '../../command-context.js';
import { catalogFlags } from '../../flags.js';
import { resolveCommands } from '../../services/catalog.js';
import { addDestinationUrls } from '../../services/destination.js';
import { openNavigation } from '../../services/navigation.js';
import { selectCommand } from '../../services/selection.js';

export default class NavigatorOpen extends SfCommand {
  static summary =
    'Find and open a Salesforce page in an authenticated browser.';
  static description =
    'Selects one navigation command and opens it using the target org authentication. Printed and JSON output never contain login credentials.';
  static examples = [
    '<%= config.bin %> <%= command.id %> "account fields" --target-org dev',
    '<%= config.bin %> <%= command.id %> --id new-flow --target-org uat',
    '<%= config.bin %> <%= command.id %> flow --target-org dev --url-only --json',
  ];
  static args = {
    query: Args.string({
      description: 'Text to match against command labels.',
      required: false,
    }),
  };
  static flags = {
    ...catalogFlags,
    id: Flags.string({
      char: 'i',
      summary: 'Exact command ID to open.',
    }),
    'url-only': Flags.boolean({
      char: 'r',
      summary:
        'Print the credential-free destination URL without opening a browser.',
      default: false,
      exclusive: ['browser'],
    }),
    browser: Flags.string({
      char: 'b',
      summary: 'Browser where the page opens.',
      options: ['chrome', 'edge', 'firefox'],
    }),
  };
  static enableJsonFlag = true;

  /** Resolve one navigation command and optionally open it in a browser. */
  async run() {
    const { args, flags } = await this.parse(NavigatorOpen);
    if (flags.id && args.query) {
      this.error('Specify either a query or --id, but not both.', { exit: 1 });
    }
    const context = await createCommandContext(this, flags);
    const matches = addDestinationUrls(
      resolveCommands({
        commands: context.catalog.commands,
        id: flags.id,
        query: args.query,
      }),
      context.instanceUrl
    );
    reportCatalogErrors(this, context.catalog.errors);

    if (matches.length === 0) {
      const selector = flags.id
        ? `ID "${flags.id}"`
        : `query "${args.query ?? ''}"`;
      this.error(`No command matches ${selector}.`, { exit: 1 });
    }

    let command;
    if (matches.length === 1) {
      [command] = matches;
    } else if (
      this.jsonEnabled() ||
      !process.stdin.isTTY ||
      !process.stdout.isTTY
    ) {
      this.error(
        `${matches.length} commands match. Refine the query or use --id with an exact command ID.`,
        { exit: 1 }
      );
    } else {
      command = await selectCommand(matches);
    }

    if (!flags['url-only']) {
      await openNavigation({
        org: context.org,
        command,
        browser: flags.browser,
      });
    }

    if (!this.jsonEnabled()) {
      if (flags['url-only']) {
        this.log(command.url);
      } else {
        this.logSuccess(`Opened ${command.label} in ${context.username}.`);
      }
    }

    return {
      orgId: context.orgId,
      username: context.username,
      command,
      url: command.url,
      opened: !flags['url-only'],
      cached: context.catalog.cached,
      generatedAt: context.catalog.generatedAt,
      errors: context.catalog.errors,
    };
  }
}
