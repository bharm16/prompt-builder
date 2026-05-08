import type { Request, Response } from "express";
import { logger } from "@infrastructure/Logger";
import type { CompatibilityService } from "@services/video-concept/services/validation/CompatibilityService";
import type { ConflictDetectionService } from "@services/video-concept/services/detection/ConflictDetectionService";

export const createVideoValidateHandler =
  (
    compatibility: CompatibilityService,
    conflictDetection: ConflictDetectionService,
  ) =>
  async (req: Request, res: Response): Promise<Response | void> => {
    const startTime = Date.now();
    const requestId = req.id || "unknown";
    const operation = "video-validate";

    const { elementType, value, elements } = req.body;

    logger.info("Video validate request received", {
      operation,
      requestId,
      elementType,
      hasValue: typeof value !== "undefined",
      elementCount: elements?.length || 0,
    });

    try {
      const compatibilityPromise =
        elementType && typeof value !== "undefined"
          ? compatibility.checkCompatibility({
              elementType,
              value,
              existingElements: elements,
            })
          : Promise.resolve(null);

      const [compatibilityResult, conflictResult] = await Promise.all([
        compatibilityPromise,
        conflictDetection.detectConflicts({ elements }),
      ]);

      logger.info("Video validate request completed", {
        operation,
        requestId,
        duration: Date.now() - startTime,
        hasCompatibility: !!compatibilityResult,
        conflictCount: conflictResult?.conflicts?.length || 0,
      });

      return res.json({
        compatibility: compatibilityResult,
        conflicts: conflictResult?.conflicts || [],
      });
    } catch (error: unknown) {
      const errorInstance =
        error instanceof Error ? error : new Error(String(error));
      logger.error("Video validate request failed", errorInstance, {
        operation,
        requestId,
        duration: Date.now() - startTime,
        elementType,
      });
      throw error;
    }
  };
