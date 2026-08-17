import { UsageTracker } from '../../../../../shared';
import { register } from './commandClassRegister';
import {
  connectDescriptorUsage,
  resolveDescriptorUsage,
} from './descriptorUsage';

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
  let { id, label } = sanitizedRaw;
  let seedUsage = 0;

  if (!id || !label) {
    const instance = new CommandCtor(sanitizedRaw);
    id = instance.id;
    label = instance.label;
    seedUsage = instance.usage ?? 0;
    sanitizedRaw.id = id;
    sanitizedRaw.label = label;
  }

  const usage = resolveDescriptorUsage(
    id,
    sanitizedRaw.usage,
    usageMap,
    seedUsage
  );
  const descriptor = {
    id,
    label,
    usage,
    className,
    createInstance: undefined,
  };
  descriptor.createInstance = () =>
    connectDescriptorUsage(
      new CommandCtor({ ...sanitizedRaw, usage }),
      descriptor
    );

  return descriptor;
}
