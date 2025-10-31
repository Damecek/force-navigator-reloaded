import { UsageTracker } from '../../../../shared';
import { register } from './commandClassRegister';

/**
 * @typedef {Object} CommandDescriptor
 * @property {string} id - Unique identifier for the command.
 * @property {string} label - Human readable label shown in the palette.
 * @property {number} usage - Usage count used for sorting.
 * @property {string} className - Name of the underlying command class.
 * @property {() => import('./Command').default} createInstance - Factory that instantiates the command.
 */

/**
 * Build descriptors for all commands returned by the background script.
 * Instances are created on-demand via the descriptor factory.
 * @param {Record<string, Array<object>>} [commandMap]
 * @returns {Promise<CommandDescriptor[]>}
 */
export async function createCommandDescriptors(commandMap = {}) {
  const tracker = await UsageTracker.instance();
  const usageMap = await tracker.usageMap();
  const descriptors = [];

  for (const [className, rawCommands] of Object.entries(commandMap)) {
    const CommandCtor = register[className];
    if (!CommandCtor) {
      console.warn(`Unknown command class received: ${className}`);
    } else if (!Array.isArray(rawCommands)) {
      console.warn(`Command payload for ${className} is not an array`);
    } else {
      for (const raw of rawCommands) {
        descriptors.push(
          buildDescriptor(CommandCtor, className, raw, usageMap)
        );
      }
    }
  }

  return descriptors;
}

/**
 * Create a descriptor for a single command entry.
 * @param {typeof import('./Command').default} CommandCtor
 * @param {string} className
 * @param {object} raw
 * @param {Record<string, number>} usageMap
 * @returns {CommandDescriptor}
 */
function buildDescriptor(CommandCtor, className, raw, usageMap) {
  const sanitizedRaw =
    raw && typeof raw === 'object'
      ? { ...raw }
      : /** @type {Record<string, any>} */ ({});
  let { id, label, usage } = sanitizedRaw;

  if (usage === undefined && id) {
    usage = usageMap[id] ?? 0;
  }

  if (!id || !label) {
    const instance = new CommandCtor({ ...sanitizedRaw, usage });
    id = instance.id;
    label = instance.label;
    usage = instance.usage ?? usage ?? 0;
    sanitizedRaw.id = id;
    sanitizedRaw.label = label;
  }

  if (usage === undefined) {
    usage = 0;
  }

  return {
    id,
    label,
    usage,
    className,
    createInstance: () => new CommandCtor({ ...sanitizedRaw, usage }),
  };
}
