/**
 * Registry for optimization modes
 * 
 * SOLID Principles Applied:
 * - OCP: New modes registered without modifying this class
 * - DIP: Manages IOptimizationMode abstractions
 */
export class ModeRegistry {
  constructor() {
    this.modes = new Map();
  }

  /**
   * Register an optimization mode
   * @param {IOptimizationMode} mode - Mode implementation
   */
  register(mode) {
    this.modes.set(mode.getName(), mode);
  }

  /**
   * Get mode by name
   * @param {string} name - Mode name
   * @returns {IOptimizationMode}
   */
  get(name) {
    const mode = this.modes.get(name);
    if (!mode) {
      throw new Error(`Unknown optimization mode: ${name}`);
    }
    return mode;
  }

  /**
   * Check if mode exists
   * @param {string} name - Mode name
   * @returns {boolean}
   */
  has(name) {
    return this.modes.has(name);
  }

  /**
   * Get all registered mode names
   * @returns {string[]}
   */
  getAllModeNames() {
    return Array.from(this.modes.keys());
  }
}
