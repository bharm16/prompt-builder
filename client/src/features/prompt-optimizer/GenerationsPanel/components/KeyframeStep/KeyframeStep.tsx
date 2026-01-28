import React, { useEffect } from 'react';
import { RefreshCw } from '@promptstudio/system/components/ui';
import { Button } from '@promptstudio/system/components/ui/button';
import type { Asset } from '@shared/types/asset';
import { KeyframeOptionCard } from './KeyframeOptionCard';
import { useKeyframeGeneration } from './hooks/useKeyframeGeneration';

interface KeyframeStepProps {
  prompt: string;
  character: Asset;
  aspectRatio: string;
  onApprove: (keyframeUrl: string) => void;
  onSkip: () => void;
}

export function KeyframeStep({
  prompt,
  character,
  aspectRatio,
  onApprove,
  onSkip,
}: KeyframeStepProps): React.ReactElement {
  const {
    keyframes,
    selectedKeyframe,
    isGenerating,
    error,
    generateKeyframes,
    selectKeyframe,
    regenerate,
  } = useKeyframeGeneration({ prompt, characterAsset: character, aspectRatio });

  useEffect(() => {
    void generateKeyframes();
  }, [generateKeyframes]);

  return (
    <div className="border-b border-border px-4 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Keyframe for {character.trigger}
          </h3>
          <p className="text-xs text-muted">Select the best face match.</p>
        </div>
        <button
          type="button"
          onClick={onSkip}
          className="text-xs font-semibold text-muted hover:text-foreground"
        >
          Skip keyframe →
        </button>
      </div>

      {isGenerating ? (
        <div className="flex items-center justify-center gap-2 py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          <span className="text-sm text-muted">Generating keyframes...</span>
        </div>
      ) : error ? (
        <div className="py-6 text-center">
          <p className="text-sm text-red-600">{error}</p>
          <Button variant="outline" size="sm" onClick={regenerate} className="mt-3">
            Try Again
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {keyframes.map((keyframe, index) => (
              <KeyframeOptionCard
                key={`${keyframe.imageUrl}-${index}`}
                keyframe={keyframe}
                isSelected={selectedKeyframe === keyframe}
                onSelect={() => selectKeyframe(keyframe)}
              />
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={regenerate}
              className="text-sm text-muted hover:text-foreground"
            >
              <RefreshCw className="mr-1 inline h-4 w-4" />
              Regenerate
            </button>

            <Button
              onClick={() => selectedKeyframe && onApprove(selectedKeyframe.imageUrl)}
              disabled={!selectedKeyframe}
            >
              Use This Keyframe
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export default KeyframeStep;
