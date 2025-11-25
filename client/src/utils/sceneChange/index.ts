/**
 * Scene Change Detection Module
 * 
 * Exports scene change detection and parsing utilities with backward compatibility
 * 
 * @example
 * import { detectAndApplySceneChange } from './utils/sceneChange';
 */

export { extractSceneContext } from './sceneContextParser.ts';
export { detectAndApplySceneChange } from './sceneChangeDetector.ts';

// Default export for backward compatibility
export { detectAndApplySceneChange as default } from './sceneChangeDetector.ts';

