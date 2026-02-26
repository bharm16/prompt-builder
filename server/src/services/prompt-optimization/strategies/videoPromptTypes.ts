import { z } from 'zod';

export interface VideoPromptTechnicalSpecs {
  duration?: string;
  aspect_ratio?: string;
  frame_rate?: string;
  audio?: string;
  resolution?: string;
  camera?: string;
  lighting?: string;
  style?: string;
}

export interface VideoPromptSlots {
  shot_framing: string;
  camera_angle: string;
  camera_move: string | null;
  subject: string | null;
  subject_details: string[] | null;
  action: string | null;
  setting: string | null;
  time: string | null;
  lighting: string | null;
  style: string | null;
}

export interface VideoPromptStructuredResponse extends VideoPromptSlots {
  _creative_strategy: string;
  technical_specs: VideoPromptTechnicalSpecs;
  variations?: Array<{ label: string; prompt: string }>;
  shot_plan?: Record<string, unknown> | null;
}

const VideoPromptTechnicalSpecsSchema = z
  .object({
    duration: z.string().optional(),
    aspect_ratio: z.string().optional(),
    frame_rate: z.string().optional(),
    audio: z.string().optional(),
    resolution: z.string().optional(),
    camera: z.string().optional(),
    lighting: z.string().optional(),
    style: z.string().optional(),
  })
  .partial();

const VideoPromptSlotsSchema = z
  .object({
    shot_framing: z.string().optional(),
    camera_angle: z.string().optional(),
    camera_move: z.string().nullable().optional(),
    subject: z.string().nullable().optional(),
    subject_details: z.array(z.string()).nullable().optional(),
    action: z.string().nullable().optional(),
    setting: z.string().nullable().optional(),
    time: z.string().nullable().optional(),
    lighting: z.string().nullable().optional(),
    style: z.string().nullable().optional(),
  })
  .partial();

export const VideoPromptStructuredResponseSchema = VideoPromptSlotsSchema.extend({
  _creative_strategy: z.string().optional(),
  technical_specs: VideoPromptTechnicalSpecsSchema.optional(),
  variations: z
    .array(
      z.object({
        label: z.string(),
        prompt: z.string(),
      })
    )
    .optional(),
  shot_plan: z.record(z.string(), z.unknown()).nullable().optional(),
}).passthrough();

export function parseVideoPromptStructuredResponse(
  raw: string
): VideoPromptStructuredResponse {
  const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const parsed = JSON.parse(cleaned) as unknown;
  const validated = VideoPromptStructuredResponseSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`Invalid video prompt JSON: ${validated.error.message}`);
  }
  return validated.data as VideoPromptStructuredResponse;
}
