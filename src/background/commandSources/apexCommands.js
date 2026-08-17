/**
 * Build Apex class navigation commands.
 * @param {Array<{Id: string, Name: string}>} records Apex class records
 * @returns {Array<{id: string, label: string, path: string}>}
 */
export function buildApexClassCommands(records) {
  return records.map(({ Id, Name }) => ({
    id: `apex-class-${Id}`,
    label: `Apex Class > ${Name}`,
    path: `/lightning/setup/ApexClasses/page?address=%2F${Id}`,
  }));
}

/**
 * Build Apex trigger navigation commands.
 * @param {Array<{Id: string, Name: string, TableEnumOrId: string}>} records Apex trigger records
 * @returns {Array<{id: string, label: string, path: string}>}
 */
export function buildApexTriggerCommands(records) {
  return records.map(({ Id, Name, TableEnumOrId }) => ({
    id: `apex-trigger-${Id}`,
    label: `Apex Trigger > ${TableEnumOrId} > ${Name}`,
    path: `/lightning/setup/ApexTriggers/page?address=%2F${Id}`,
  }));
}
