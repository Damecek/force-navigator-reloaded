import { createInterface } from 'node:readline/promises';

export const MAX_INTERACTIVE_CHOICES = 20;

/**
 * Select a command interactively from ranked matches.
 * @param {object[]} commands Ranked commands.
 * @param {{input?: NodeJS.ReadableStream, output?: NodeJS.WritableStream}} [streams] Prompt streams.
 * @returns {Promise<object>}
 */
export async function selectCommand(
  commands,
  { input = process.stdin, output = process.stdout } = {}
) {
  const choices = commands.slice(0, MAX_INTERACTIVE_CHOICES);
  choices.forEach((command, index) => {
    output.write(`${index + 1}. ${command.label} [${command.source}]\n`);
  });
  if (commands.length > choices.length) {
    output.write(
      `Showing the first ${choices.length} of ${commands.length} matches.\n`
    );
  }

  const prompt = createInterface({ input, output });
  try {
    const answer = await prompt.question(
      `Select a command [1-${choices.length}]: `
    );
    const selectedIndex = Number(answer) - 1;
    if (!Number.isInteger(selectedIndex) || !choices[selectedIndex]) {
      throw new Error(
        `Selection must be a number from 1 to ${choices.length}.`
      );
    }
    return choices[selectedIndex];
  } finally {
    prompt.close();
  }
}
