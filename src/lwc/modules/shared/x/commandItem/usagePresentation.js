/**
 * Create the visual and accessible command usage presentation.
 * @param {{ label?: string, usage?: number }} command
 * @param {boolean} showUsage
 * @returns {{ accessibleLabel: string, isVisible: boolean, text: string }}
 */
export function getUsagePresentation(command, showUsage) {
  const label = typeof command?.label === 'string' ? command.label : '';
  const usage = Number(command?.usage);
  const isVisible = showUsage === true && Number.isInteger(usage) && usage > 0;
  const text = isVisible ? `${usage} uses` : '';

  return {
    accessibleLabel: text ? `${label}, ${text}` : label,
    isVisible,
    text,
  };
}
