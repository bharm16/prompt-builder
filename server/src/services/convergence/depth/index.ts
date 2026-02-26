/**
 * Depth Estimation module for Visual Convergence
 *
 * Provides depth map generation using Depth Anything v2 via fal.ai.
 * Used for client-side camera motion rendering with Three.js.
 *
 * @module convergence/depth
 */

export type { DepthEstimationService, DepthEstimationServiceOptions } from './DepthEstimationService';
export type { DepthModuleConfig } from './DepthEstimationService';
export type { DepthEstimationProvider, FalDepthResponse } from './types';
export {
  FalDepthEstimationService,
  createDepthEstimationService,
  createDepthEstimationServiceForUser,
  getDepthWarmupStatus,
  getStartupWarmupPromise,
  initializeDepthWarmer,
  setDepthEstimationModuleConfig,
  warmupDepthEstimationOnStartup,
} from './DepthEstimationService';
