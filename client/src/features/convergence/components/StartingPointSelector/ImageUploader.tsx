/**
 * ImageUploader Component
 *
 * Handles image upload for the upload starting point.
 */

import React, { useCallback, useState } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';

import { logger } from '@/services/LoggingService';
import { convergenceApi } from '@/features/convergence/api';
import { cn } from '@/utils/cn';

const log = logger.child('ImageUploader');

export interface ImageUploaderProps {
  onImageUploaded: (url: string) => void;
  onConfirm: () => void;
  uploadedUrl: string | null;
  isLoading: boolean;
  disabled?: boolean;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  onImageUploaded,
  onConfirm,
  uploadedUrl,
  isLoading,
  disabled = false,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      setError(null);
      setIsUploading(true);

      try {
        const result = await convergenceApi.uploadImage(file);
        onImageUploaded(result.url);
      } catch (uploadError) {
        const message =
          uploadError instanceof Error ? uploadError.message : 'Upload failed.';
        setError(message);
        log.warn('Image upload failed', { error: message });
      } finally {
        setIsUploading(false);
        event.target.value = '';
      }
    },
    [onImageUploaded]
  );

  const isDisabled = disabled || isUploading || isLoading;

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-surface-2 p-4',
        isDisabled && 'opacity-60'
      )}
      data-testid="image-uploader"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">Upload a reference</h3>
          <p className="text-sm text-muted">
            Use a clear image to anchor the first frame.
          </p>
        </div>

        <label className={cn('inline-flex items-center gap-2', isDisabled && 'cursor-not-allowed')}>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={isDisabled}
            className="hidden"
          />
          <span
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
              'border border-border bg-surface-1 text-foreground',
              !isDisabled && 'hover:border-primary/50 hover:bg-primary/5',
              isDisabled && 'cursor-not-allowed'
            )}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <ImagePlus className="h-4 w-4" aria-hidden="true" />
            )}
            {isUploading ? 'Uploading...' : 'Choose Image'}
          </span>
        </label>
      </div>

      {error && (
        <p className="mt-3 text-sm text-rose-400" role="alert">
          {error}
        </p>
      )}

      {uploadedUrl && (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg overflow-hidden border border-border bg-surface-1">
            <img
              src={uploadedUrl}
              alt="Uploaded reference"
              className="w-full h-56 object-cover"
            />
          </div>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading || !uploadedUrl}
            className={cn(
              'w-full sm:w-auto px-5 py-2 rounded-lg text-sm font-semibold',
              'bg-primary text-primary-foreground hover:bg-primary/90',
              (isLoading || !uploadedUrl) && 'opacity-60 cursor-not-allowed'
            )}
          >
            Use This Image
          </button>
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
