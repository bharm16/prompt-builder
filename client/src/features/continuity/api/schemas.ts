import { z } from "zod";
import {
  SessionContinuityShotSchema,
  SessionContinuitySettingsSchema,
  SessionSceneProxySchema,
  SessionStatusSchema,
  SessionStyleReferenceSchema,
} from "@shared/schemas/session.schemas";

// The client's ContinuitySession is a flattened view: session metadata
// merged with its continuity block. The server models session + continuity
// as a parent/child pair (SessionDto → SessionContinuity). We keep the
// client wrapper local because the UI expects the flattened shape.
export const ContinuitySessionSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    name: z.string(),
    description: z.string().optional(),
    primaryStyleReference: SessionStyleReferenceSchema.nullable().optional(),
    sceneProxy: SessionSceneProxySchema.nullable().optional(),
    shots: z.array(SessionContinuityShotSchema),
    defaultSettings: SessionContinuitySettingsSchema,
    status: SessionStatusSchema,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .passthrough();

export const ContinuityApiResponseSchema = <T extends z.ZodTypeAny>(
  dataSchema: T,
) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
  });
