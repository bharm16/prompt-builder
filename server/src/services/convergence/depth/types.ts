/**
 * fal.ai Depth Anything V2 response shape
 */
export interface FalDepthResponse {
  image: {
    url: string;
    content_type: string;
    file_name: string;
    file_size: number;
    width: number;
    height: number;
  };
}

/**
 * Provider used for depth estimation
 */
export type DepthEstimationProvider = 'fal.ai';
