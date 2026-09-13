import { Args } from '@oclif/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import {
  createCommandContext,
  reportCatalogErrors,
} from '../../command-context.js';
import { catalogFlags } from '../../flags.js';
import {
  didAllSourcesFail,
  searchCatalog,
  stripMatchRanges,
} from '../../services/catalog.js';
import { addDestinationUrls } from '../../services/destination.js';
import { formatCommandLine } from '../../services/highlight.js';

export default class NavigatorSearch extends SfCommand {
  static summary = 'Search Salesforce setup pages and metadata in an org.';
  static description =
    'Loads the same navigation catalog as Force Navigator Reloaded and returns ranked matches.';
  static examples = [
    '<%= config.bin %> <%= command.id %> "account fields" --target-org dev',
    '<%= config.bin %> <%= command.id %> flow --target-org uat --source flows --json',
    '<%= config.bin %> <%= command.id %> "deployment status" --show-id',
  ];
  static args = {
    query: Args.string({
      description: 'Text to match against command labels.',
      required: false,
      default: '',
    }),
  };
  static flags = {
    ...catalogFlags,
    'show-id': Flags.boolean({
      summary: 'Append the exact command ID to each printed match.',
      default: false,
    }),
  };
  static enableJsonFlag = true;

  /** Load, search, and render an org's navigation catalog. */
  async run() {
    const { args, flags } = await this.parse(NavigatorSearch);
    const context = await createCommandContext(this, flags);
    const commands = addDestinationUrls(
      searchCatalog(context.catalog.commands, args.query),
      context.instanceUrl
    );
    reportCatalogErrors(this, context.catalog.errors);
    if (
      didAllSourcesFail({
        errors: context.catalog.errors,
        sources: context.sources,
      })
    ) {
      this.error('Every selected command source failed to load.', { exit: 1 });
    }

    if (!this.jsonEnabled()) {
      if (commands.length === 0) {
        this.log('No matching commands.');
      } else {
        commands.forEach((command) => {
          const line = formatCommandLine(command);
          this.log(flags['show-id'] ? `${line}\t${command.id}` : line);
        });
      }
    }

    return {
      orgId: context.orgId,
      username: context.username,
      instanceUrl: context.instanceUrl,
      query: args.query,
      sources: context.sources,
      cached: context.catalog.cached,
      generatedAt: context.catalog.generatedAt,
      commands: commands.map(stripMatchRanges),
      errors: context.catalog.errors,
    };
  }
}
