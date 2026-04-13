import { Blob as NodeBlob } from "node:buffer";

type LogSink = {
  info: (message: string, meta?: Record<string, unknown>) => void;
};

export const SUPPORTED_IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
]);

export const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export const isBlobLike = (value: unknown): value is Blob =>
  (typeof Blob !== "undefined" && value instanceof Blob) ||
  value instanceof NodeBlob;

export function normalizeContentType(value: string | null): string {
  return value?.split(";")[0]?.trim().toLowerCase() ?? "";
}

export function getUrlExtension(value: string): string | null {
  try {
    const url = new URL(value);
    const pathname = url.pathname.toLowerCase();
    const lastDot = pathname.lastIndexOf(".");
    if (lastDot < 0) {
      return null;
    }
    return pathname.slice(lastDot);
  } catch {
    return null;
  }
}

export function summarizeInputForLog(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const summary: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (isBlobLike(value)) {
      summary[key] = {
        type: "Blob",
        size: value.size,
        mime: value.type,
      };
      continue;
    }
    if (Buffer.isBuffer(value)) {
      summary[key] = {
        type: "Buffer",
        size: value.length,
      };
      continue;
    }
    if (typeof value === "string" && value.startsWith("data:")) {
      const mime = value.slice(5, value.indexOf(";")) || "unknown";
      summary[key] = {
        type: "data-uri",
        length: value.length,
        mime,
      };
      continue;
    }
    summary[key] = value;
  }
  return summary;
}

export async function resolveImageInput(
  imageUrl: string,
  log: LogSink,
  fieldName: "startImage" | "style_reference",
): Promise<string | Blob> {
  if (imageUrl.startsWith("data:")) {
    return imageUrl;
  }

  const extension = getUrlExtension(imageUrl);
  if (extension && SUPPORTED_IMAGE_EXTENSIONS.has(extension)) {
    return imageUrl;
  }

  log.info("Fetching image for Replicate input", {
    field: fieldName,
    hasExtension: Boolean(extension),
  });

  const response = await fetch(imageUrl, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${fieldName} (${response.status})`);
  }

  const contentType = normalizeContentType(
    response.headers.get("content-type"),
  );
  if (!SUPPORTED_IMAGE_MIME_TYPES.has(contentType)) {
    throw new Error(
      `Unsupported ${fieldName} format '${contentType || "unknown"}'. Supported formats: .jpg, .jpeg, .png, .webp`,
    );
  }

  const buffer = await response.arrayBuffer();
  const BlobCtor =
    typeof globalThis.Blob === "function"
      ? globalThis.Blob
      : (NodeBlob as unknown as typeof Blob);
  return new BlobCtor([buffer], { type: contentType });
}
