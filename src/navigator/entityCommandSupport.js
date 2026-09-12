/**
 * Determines whether an entity supports navigation to its new-record page.
 * @param {{QualifiedApiName?: string, IsEverCreatable?: boolean, IsCompactLayoutable?: boolean}} entity
 * @returns {boolean}
 */
export function supportsNewRecordNavigation(entity) {
  return (
    entity?.QualifiedApiName !== 'FlowInterview' &&
    entity?.IsEverCreatable === true &&
    entity?.IsCompactLayoutable === true
  );
}
