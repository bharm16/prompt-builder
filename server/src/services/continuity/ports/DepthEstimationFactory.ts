export interface DepthEstimationService {
  isAvailable(): boolean;
  estimateDepth(input: string): Promise<string>;
}

export type DepthEstimationFactory = (
  userId: string,
) => DepthEstimationService;
