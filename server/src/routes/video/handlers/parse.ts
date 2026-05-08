import type { Request, Response } from "express";
import { logger } from "@infrastructure/Logger";
import type { ConceptParsingService } from "@services/video-concept/services/analysis/ConceptParsingService";

export const createVideoParseHandler =
  (conceptParsing: ConceptParsingService) =>
  async (req: Request, res: Response): Promise<Response | void> => {
    const startTime = Date.now();
    const requestId = req.id || "unknown";
    const operation = "video-parse";

    const { concept } = req.body;

    logger.info("Video parse request received", {
      operation,
      requestId,
      conceptLength: concept?.length || 0,
    });

    try {
      const parsed = await conceptParsing.parseConcept({ concept });

      logger.info("Video parse request completed", {
        operation,
        requestId,
        duration: Date.now() - startTime,
        elementCount: parsed?.elements?.length || 0,
      });

      return res.json(parsed);
    } catch (error: unknown) {
      const errorInstance =
        error instanceof Error ? error : new Error(String(error));
      logger.error("Video parse request failed", errorInstance, {
        operation,
        requestId,
        duration: Date.now() - startTime,
        conceptLength: concept?.length || 0,
      });
      throw error;
    }
  };
