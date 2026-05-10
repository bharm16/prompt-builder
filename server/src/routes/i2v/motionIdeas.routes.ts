/**
 * Motion Ideas Route
 *
 * POST /api/i2v/motion-ideas
 *
 * Translates an image observation into 3-5 short motion phrases the user
 * can pick from when adding motion to a still image.
 */

import express, { type Router, type Request, type Response } from "express";
import { z } from "zod";
import { logger } from "@infrastructure/Logger";
import { asyncHandler } from "@middleware/asyncHandler";
import type { MotionIdeaService } from "@services/i2v-motion-ideas/MotionIdeaService";

const MotionIdeasRequestSchema = z
  .object({
    image: z.string().min(1),
    sourcePrompt: z.string().min(1).optional(),
    skipCache: z.boolean().optional(),
    temperature: z.number().min(0).max(2).optional(),
  })
  .strip();

export function createMotionIdeasRoutes(
  motionIdeaService: MotionIdeaService,
): Router {
  const router = express.Router();

  router.post(
    "/i2v/motion-ideas",
    asyncHandler(async (req: Request, res: Response) => {
      const startTime = Date.now();
      const requestId = (req as Request & { id?: string }).id ?? "unknown";
      const log = logger.child({
        route: "/i2v/motion-ideas",
        requestId,
      });

      const parsed = MotionIdeasRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          error: "Invalid request",
          details: parsed.error.issues,
        });
      }

      log.info("motion-ideas request received");

      const result = await motionIdeaService.generate({
        image: parsed.data.image,
        ...(parsed.data.sourcePrompt
          ? { sourcePrompt: parsed.data.sourcePrompt }
          : {}),
        ...(parsed.data.skipCache !== undefined
          ? { skipCache: parsed.data.skipCache }
          : {}),
        ...(parsed.data.temperature !== undefined
          ? { temperature: parsed.data.temperature }
          : {}),
      });

      log.info("motion-ideas request completed", {
        durationMs: Date.now() - startTime,
        ideaCount: result.ideas.length,
        observationCached: result.observationCached,
      });

      return res.json({
        success: true,
        ideas: result.ideas,
        observationCached: result.observationCached,
        observationUsedFastPath: result.observationUsedFastPath,
        durationMs: result.durationMs,
      });
    }),
  );

  return router;
}
