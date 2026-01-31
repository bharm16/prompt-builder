import { useCallback, useState } from 'react';
import { z } from 'zod';
import { storageApi } from '@/api/storageApi';

interface UploadResult {
  storagePath: string;
  sizeBytes: number;
  contentType?: string;
  createdAt?: string;
}

interface UploadUrlResult {
  uploadUrl: string;
  storagePath: string;
  maxSizeBytes: number;
}

const UploadUrlResultSchema: z.ZodType<UploadUrlResult> = z.object({
  uploadUrl: z.string(),
  storagePath: z.string(),
  maxSizeBytes: z.number(),
});

const UploadResultSchema: z.ZodType<UploadResult> = z.object({
  storagePath: z.string(),
  sizeBytes: z.number(),
  contentType: z.string().optional(),
  createdAt: z.string().optional(),
});

const ViewUrlResultSchema = z.object({
  viewUrl: z.string(),
});

interface UseMediaStorageResult {
  uploadFile: (file: File, type: string, metadata?: Record<string, unknown>) => Promise<UploadResult>;
  getViewUrl: (storagePath: string) => Promise<string>;
  deleteFile: (storagePath: string) => Promise<void>;
  listFiles: (options?: { type?: string; limit?: number; cursor?: string }) => Promise<unknown>;
  uploading: boolean;
  uploadProgress: number;
  error: string | null;
  clearError: () => void;
}

export function useMediaStorage(): UseMediaStorageResult {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = useCallback(
    async (file: File, type: string, metadata: Record<string, unknown> = {}) => {
      setUploading(true);
      setUploadProgress(0);
      setError(null);

      try {
        const { uploadUrl, storagePath, maxSizeBytes } = UploadUrlResultSchema.parse(
          await storageApi.getUploadUrl(type, file.type, metadata)
        );

        if (file.size > maxSizeBytes) {
          throw new Error(`File too large. Max size: ${Math.round(maxSizeBytes / 1024 / 1024)}MB`);
        }

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              setUploadProgress(Math.round((event.loaded / event.total) * 100));
            }
          });

          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload failed: ${xhr.status}`));
            }
          });

          xhr.addEventListener('error', () => reject(new Error('Upload failed')));
          xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

          xhr.open('PUT', uploadUrl);
          xhr.setRequestHeader('Content-Type', file.type);
          xhr.send(file);
        });

        const confirmed = UploadResultSchema.parse(
          await storageApi.confirmUpload(storagePath)
        );

        setUploading(false);
        setUploadProgress(100);

        return confirmed;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        setError(message);
        setUploading(false);
        throw err;
      }
    },
    []
  );

  const getViewUrl = useCallback(async (storagePath: string) => {
    try {
      const { viewUrl } = ViewUrlResultSchema.parse(
        await storageApi.getViewUrl(storagePath)
      );
      return viewUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch view URL';
      setError(message);
      throw err;
    }
  }, []);

  const deleteFile = useCallback(async (storagePath: string) => {
    try {
      await storageApi.deleteFile(storagePath);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete file';
      setError(message);
      throw err;
    }
  }, []);

  const listFiles = useCallback(async (options: { type?: string; limit?: number; cursor?: string } = {}) => {
    try {
      return await storageApi.listFiles(options);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to list files';
      setError(message);
      throw err;
    }
  }, []);

  return {
    uploadFile,
    getViewUrl,
    deleteFile,
    listFiles,
    uploading,
    uploadProgress,
    error,
    clearError: () => setError(null),
  };
}

export default useMediaStorage;
