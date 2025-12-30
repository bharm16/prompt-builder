import Replicate from 'replicate';
import { logger } from '@infrastructure/Logger';
import { VIDEO_MODELS } from '@config/modelConfig';

interface ReplicateOptions {
  apiToken: string;
}

interface VideoGenerationOptions {
  model?: keyof typeof VIDEO_MODELS;
  aspectRatio?: '16:9' | '9:16' | '21:9' | '1:1';
  numFrames?: number;
  fps?: number;
  negativePrompt?: string;
}

/**
 * VideoGenerationService - Handles video generation using Replicate
 *
 * This service implements the 2025 hierarchy of video models,
 * primarily focusing on the Wan 2.1 series.
 */
export class VideoGenerationService {
  private readonly replicate: Replicate | null;
  private readonly log = logger.child({ service: 'VideoGenerationService' });

  constructor(options: ReplicateOptions) {
    if (!options.apiToken) {
      this.log.warn('REPLICATE_API_TOKEN not provided, video generation will be disabled');
      this.replicate = null;
    } else {
      this.replicate = new Replicate({
        auth: options.apiToken,
      });
    }
  }

  /**
   * Generate a video from a prompt
   * 
   * @param prompt - The optimized prompt
   * @param options - Generation options (model, aspect ratio, etc.)
   * @returns URL of the generated video
   */
  async generateVideo(prompt: string, options: VideoGenerationOptions = {}): Promise<string> {
    if (!this.replicate) {
      throw new Error('Video generation service is not configured. REPLICATE_API_TOKEN is required.');
    }

    const tier = options.model || 'PRO';
    // Use the exact model ID from config, defaulting to the fast one if needed
    const modelId = VIDEO_MODELS[tier] || "wan-video/wan-2.2-t2v-fast";

    this.log.info('Starting video generation', {
      tier,
      model: modelId,
      promptLength: prompt.length,
    });

    try {
      // Build input object matching the user's example and model requirements
      const input: any = {
        prompt,
        aspect_ratio: options.aspectRatio || '16:9',
      };

      if (options.negativePrompt) {
        input.negative_prompt = options.negativePrompt;
      }

      // Wan 2.x specific parameters based on the fast model requirements
      if (modelId.includes('wan')) {
        input.num_frames = options.numFrames || 81;
        input.go_fast = true;
        input.resolution = "480p"; // Default for fast model
        input.frames_per_second = options.fps || 16;
        input.sample_shift = 8; // User example used 12, I'll stick to 8 or 12. Let's use 8 as previously decided for stability, or 12 as per example. 
        // User example used 12. Let's use 12 to match the "working" example.
        input.sample_shift = 12;
      }

      this.log.info('Calling replicate.run', { modelId, input });

      // Use replicate.run() instead of predictions.create() + polling
      // casting modelId to any because the type definition might be strict about exact strings
      const output = await this.replicate.run(modelId as any, { input });

      this.log.info('replicate.run finished', { 
        outputType: typeof output, 
        outputKeys: output && typeof output === 'object' ? Object.keys(output) : [],
        outputValue: typeof output === 'string' ? output : 'object' 
      });

      // Handle output
      if (typeof output === 'string') {
        // Direct URL string
        if (output.startsWith('http')) {
             return output;
        }
        // Maybe a path?
        this.log.warn('Output is a string but not http', { output });
      }

      // Check for file output with url() method (Replicate SDK v1.0.0+)
      if (output && typeof output === 'object') {
          // Check if it's a FileOutput object (has url method)
          if ('url' in output && typeof (output as any).url === 'function') {
              const url = (output as any).url();
              this.log.info('Extracted URL from FileOutput', { url: url.toString() });
              return url.toString();
          }
          
          // Check if it's a stream that we need to handle? 
          // Usually for web apps we want the URL. 
          // If replicate.run returns a stream, it might be because we requested a file.
          
          // If it is an array (some models return [url])
          if (Array.isArray(output) && output.length > 0 && typeof output[0] === 'string') {
              return output[0];
          }
      }

      // Fallback: If we can't extract a URL, log error and throw
      this.log.error('Could not extract video URL from output', { output });
      throw new Error('Invalid output format from Replicate: Could not extract video URL');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log.error('Video generation failed', error instanceof Error ? error : new Error(errorMessage));
      throw error;
    }
  }
}