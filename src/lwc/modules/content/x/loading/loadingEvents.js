export const COMMAND_LOADING_EVENT = 'forcenavigatorcommandloading';

/**
 * Publish command loading state so app can show or hide the spinner.
 * @param {boolean} isLoading
 */
export function publishCommandLoading(isLoading) {
  window.dispatchEvent(
    new CustomEvent(COMMAND_LOADING_EVENT, {
      detail: { isLoading },
    })
  );
}
