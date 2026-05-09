/**
 * Re-exports from the shared schema layer.
 *
 * Canonical schemas live in `shared/schemas/asset.schemas.ts`. Server and
 * client both derive `ReferenceImage` from `ReferenceImageSchema` so the
 * wire shape stays in one place.
 */
export {
  ReferenceImageSchema,
  ReferenceImageMetadataSchema,
  ReferenceImageListSchema,
} from "@shared/schemas/asset.schemas";
