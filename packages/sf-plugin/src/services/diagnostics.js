/** Collect optional startup diagnostics and print them after the loading spinner. */
export class Diagnostics {
  /**
   * @param {{enabled?: boolean, write?: (line: string) => void, now?: () => number}} options Output and clock.
   */
  constructor({
    enabled = false,
    write = () => {},
    now = () => performance.now(),
  } = {}) {
    this.enabled = enabled;
    this.write = write;
    this.now = now;
    this.lines = [];
  }

  /** @param {string} message Credential-free diagnostic text. */
  note(message) {
    if (this.enabled) this.lines.push(message);
  }

  /**
   * Time an operation without recording its input, output data, or error message.
   * @template T
   * @param {string} label Operation name.
   * @param {() => Promise<T>} run Operation.
   * @param {(value: T) => string} [summary] Safe counts/status to include.
   * @returns {Promise<T>}
   */
  async measure(label, run, summary = () => '') {
    if (!this.enabled) return run();
    const started = this.now();
    let result;
    try {
      result = await run();
    } catch (error) {
      this.note(`${label}: ${Math.round(this.now() - started)} ms, failed`);
      throw error;
    }
    const detail = summary(result);
    this.note(
      `${label}: ${Math.round(this.now() - started)} ms${detail ? `, ${detail}` : ''}`
    );
    return result;
  }

  /** Print once, outside the interactive palette and loading spinner. */
  flush() {
    for (const line of this.lines) this.write(`[debug] ${line}`);
    this.lines.length = 0;
  }
}
