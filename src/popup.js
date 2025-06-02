/**
 * Popup script entry point: initializes popup UI on DOMContentLoaded.
 * @returns {void}
 */
document.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('app');
  app.textContent = 'Hello from popup!';
});
