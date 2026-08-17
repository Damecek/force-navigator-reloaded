/**
 * Resolve the usage count for a command descriptor.
 * @param {string} id
 * @param {number|undefined} providedUsage
 * @param {Record<string, number>} usageMap
 * @param {number} seedUsage
 * @returns {number}
 */
export function resolveDescriptorUsage(
  id,
  providedUsage,
  usageMap,
  seedUsage = 0
) {
  return providedUsage ?? usageMap[id] ?? seedUsage;
}

/**
 * Keep a descriptor synchronized with usage recorded by its command instance.
 * @param {{onUsageChange?: (usage: number) => void}} instance
 * @param {{usage: number}} descriptor
 * @returns {object}
 */
export function connectDescriptorUsage(instance, descriptor) {
  instance.onUsageChange = (usage) => {
    descriptor.usage = usage;
  };
  return instance;
}
