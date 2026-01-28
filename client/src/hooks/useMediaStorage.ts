import { useCallback, useState } from 'react';
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

export function useMediaStorage() {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = useCallback(
    async (file: File, type: string, metadata: Record<string, unknown> = {}) => {
      setUploading(true);
      setUploadProgress(0);
      setError(null);

      try {
        const { uploadUrl, storagePath, maxSizeBytes } =
          (await storageApi.getUploadUrl(type, file.type, metadata)) as UploadUrlResult;

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

        const confirmed = (await storageApi.confirmUpload(storagePath)) as UploadResult;

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
      const { viewUrl } = (await storageApi.getViewUrl(storagePath)) as { viewUrl: string };
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
