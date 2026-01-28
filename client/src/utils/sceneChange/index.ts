/**
 * Scene Change Detection Module
 * 
 * Exports scene change detection and parsing utilities with backward compatibility
 * 
 * @example
 * import { detectAndApplySceneChange } from './utils/sceneChange';
 */

export { extractSceneContext } from './sceneContextParser.ts';
export { detectSceneChange } from './sceneChangeApi';
export { applySceneChangeUpdates } from './sceneChangeUpdates';
export { detectAndApplySceneChange } from './sceneChangeDetector.ts';
export type { SceneChangeParams, SceneChangeRequest, SceneChangeResponse } from './types';

// Default export for backward compatibility
export { detectAndApplySceneChange as default } from './sceneChangeDetector.ts';
