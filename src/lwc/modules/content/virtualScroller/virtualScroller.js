/**
 * Helper to compute visible item range for a scrollable list.
 */
export default class VirtualScroller {
  /**
   * @param {HTMLElement} container The scrolling container
   * @param {number} itemHeight Height of one item in pixels
   * @param {number} buffer Number of items to render outside of viewport
   */
  constructor(container, itemHeight = 36, buffer = 5) {
    this.container = container;
    this.itemHeight = itemHeight;
    this.buffer = buffer;
  }

  /**
   * Calculate start and end indexes of visible items.
   * @param {number} total Total number of items
   * @returns {[number, number]} Tuple of start and end indexes (exclusive)
   */
  getVisibleRange(total) {
    const scrollTop = this.container.scrollTop;
    const containerHeight = this.container.clientHeight;
    const start = Math.floor(scrollTop / this.itemHeight) - this.buffer;
    const visible = Math.ceil(containerHeight / this.itemHeight);
    const bufferSize = this.buffer * 2;
    const count = visible + bufferSize;
    const end = start + count;
    return [Math.max(0, start), Math.min(total, end)];
  }
}
