import { Args } from '@oclif/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import {
  createCommandContext,
  reportCatalogErrors,
} from '../../command-context.js';
import { catalogFlags } from '../../flags.js';
import { didAllSourcesFail } from '../../services/catalog.js';
import { runPalette } from '../../services/palette.js';

export default class NavigatorOpen extends SfCommand {
  static summary = 'Open the interactive Salesforce navigation palette.';
  static description =
    'Type to filter commands, use arrow keys to select, and press Enter to open the page in the target org. Prefix a term with ? to open Salesforce global record search.';
  static examples = [
    '<%= config.bin %> <%= command.id %> --target-org dev',
    '<%= config.bin %> <%= command.id %> "account fields" --target-org dev',
    '<%= config.bin %> <%= command.id %> "? Acme" --target-org dev',
  ];
  static args = {
    query: Args.string({
      description: 'Optional text to prefill the editable palette search.',
      required: false,
    }),
  };
  static flags = {
    ...catalogFlags,
    browser: Flags.string({
      char: 'b',
      summary: 'Browser where the selected page opens.',
      options: ['chrome', 'edge', 'firefox'],
    }),
  };
  static enableJsonFlag = false;

  /** Load the target org catalog and open a page after interactive selection. */
  async run() {
    const { args, flags } = await this.parse(NavigatorOpen);
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      this.error('Run sf navigator open in an interactive terminal.', {
        exit: 1,
      });
    }
    const context = await createCommandContext(this, flags);
    reportCatalogErrors(this, context.catalog.errors);
    if (
      didAllSourcesFail({
        errors: context.catalog.errors,
        sources: context.sources,
      })
    ) {
      this.error('Every selected command source failed to load.', { exit: 1 });
    }
    await runPalette({
      context,
      query: args.query ?? '',
      browser: flags.browser,
      dataDirectory: this.config.dataDir,
      log: (message) => this.log(message),
      warn: (message) => this.warn(message),
    });
  }
}
