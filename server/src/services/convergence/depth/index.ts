/**
 * Depth Estimation module for Visual Convergence
 *
 * Provides depth map generation using Depth Anything v2 via Replicate API.
 * Used for client-side camera motion rendering with Three.js.
 *
 * @module convergence/depth
 */

export type { DepthEstimationService, DepthEstimationServiceOptions } from './DepthEstimationService';
export {
  ReplicateDepthEstimationService,
  createDepthEstimationService,
  createDepthEstimationServiceForUser,
} from './DepthEstimationService';
