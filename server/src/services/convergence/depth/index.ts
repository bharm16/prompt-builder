/**
 * Depth Estimation module for Visual Convergence
 *
 * Provides depth map generation using Depth Anything v2 via fal.ai (with Replicate fallback).
 * Used for client-side camera motion rendering with Three.js.
 *
 * @module convergence/depth
 */

export type { DepthEstimationService, DepthEstimationServiceOptions } from './DepthEstimationService';
export type { DepthEstimationProvider, FalDepthResponse } from './types';
export {
  ReplicateDepthEstimationService,
  createDepthEstimationService,
  createDepthEstimationServiceForUser,
  getDepthWarmupStatus,
  getStartupWarmupPromise,
  initializeDepthWarmer,
  warmupDepthEstimationOnStartup,
} from './DepthEstimationService';
