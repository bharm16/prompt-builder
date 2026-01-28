import React, { useState } from 'react';
import type { AssetType } from '@shared/types/asset';
import { Button } from '@promptstudio/system/components/ui/button';

interface ReferenceImageUploaderProps {
  assetType: AssetType;
  onUpload: (file: File, metadata: Record<string, string | undefined>) => Promise<void>;
  maxImages: number;
  currentCount: number;
}

export function ReferenceImageUploader({
  assetType,
  onUpload,
  maxImages,
  currentCount,
}: ReferenceImageUploaderProps): React.ReactElement {
  const [isUploading, setIsUploading] = useState(false);
  const [metadata, setMetadata] = useState<Record<string, string | undefined>>({});

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      await onUpload(file, metadata);
      setMetadata({});
      event.target.value = '';
    } finally {
      setIsUploading(false);
    }
  };

  const isAtLimit = currentCount >= maxImages;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface-2 p-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-foreground">Reference images</h4>
          <p className="text-xs text-muted">
            {currentCount}/{maxImages} uploaded
          </p>
        </div>
        <Button type="button" variant="outline" disabled={isUploading || isAtLimit}>
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              disabled={isUploading || isAtLimit}
            />
            {isUploading ? 'Uploading...' : 'Upload image'}
          </label>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-muted sm:grid-cols-3">
        {assetType === 'character' && (
          <>
            <select
              value={metadata.angle || ''}
              onChange={(event) =>
                setMetadata((prev) => ({ ...prev, angle: event.target.value || undefined }))
              }
              className="rounded-md border border-border bg-surface-1 px-2 py-1"
            >
              <option value="">Angle</option>
              <option value="front">Front</option>
              <option value="profile">Profile</option>
              <option value="three-quarter">Three-quarter</option>
              <option value="back">Back</option>
            </select>
            <select
              value={metadata.expression || ''}
              onChange={(event) =>
                setMetadata((prev) => ({ ...prev, expression: event.target.value || undefined }))
              }
              className="rounded-md border border-border bg-surface-1 px-2 py-1"
            >
              <option value="">Expression</option>
              <option value="neutral">Neutral</option>
              <option value="smiling">Smiling</option>
              <option value="serious">Serious</option>
              <option value="expressive">Expressive</option>
            </select>
          </>
        )}

        {assetType === 'style' && (
          <select
            value={metadata.styleType || ''}
            onChange={(event) =>
              setMetadata((prev) => ({ ...prev, styleType: event.target.value || undefined }))
            }
            className="rounded-md border border-border bg-surface-1 px-2 py-1"
          >
            <option value="">Style type</option>
            <option value="color-palette">Color palette</option>
            <option value="mood-board">Mood board</option>
            <option value="reference-frame">Reference frame</option>
          </select>
        )}

        {assetType === 'location' && (
          <select
            value={metadata.timeOfDay || ''}
            onChange={(event) =>
              setMetadata((prev) => ({ ...prev, timeOfDay: event.target.value || undefined }))
            }
            className="rounded-md border border-border bg-surface-1 px-2 py-1"
          >
            <option value="">Time of day</option>
            <option value="day">Day</option>
            <option value="night">Night</option>
            <option value="golden-hour">Golden hour</option>
            <option value="blue-hour">Blue hour</option>
          </select>
        )}

        <select
          value={metadata.lighting || ''}
          onChange={(event) =>
            setMetadata((prev) => ({ ...prev, lighting: event.target.value || undefined }))
          }
          className="rounded-md border border-border bg-surface-1 px-2 py-1"
        >
          <option value="">Lighting</option>
          <option value="natural">Natural</option>
          <option value="studio">Studio</option>
          <option value="dramatic">Dramatic</option>
          <option value="backlit">Backlit</option>
        </select>
      </div>
    </div>
  );
}

export default ReferenceImageUploader;
