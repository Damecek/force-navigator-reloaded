import { Org } from '@salesforce/core';
import {
  loadCatalog,
  SALESFORCE_API_VERSION,
  SOURCE_NAMES,
} from '../lib/core/index.js';
import { createNavigatorConnection } from '../lib/services/connection.js';
import { addDestinationUrls } from '../lib/services/destination.js';

export type NavigationCommand = {
  id: string;
  label: string;
  path: string;
  host?: 'core' | 'lightning' | 'setup';
  source: string;
  url: string;
};

/** Load the complete palette catalog through the plugin's internal services. */
export async function loadNavigationCatalog(
  org: Org
): Promise<NavigationCommand[]> {
  const result = await loadCatalog({
    sources: SOURCE_NAMES,
    connection: createNavigatorConnection(org, SALESFORCE_API_VERSION),
  });
  if (result.errors.length > 0) {
    throw new Error(
      `Catalog sources failed: ${result.errors.map(({ source }: { source: string }) => source).join(', ')}`
    );
  }
  return addDestinationUrls(
    result.commands,
    org.getConnection(SALESFORCE_API_VERSION).instanceUrl
  );
}
