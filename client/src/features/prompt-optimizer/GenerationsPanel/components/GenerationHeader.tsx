import React, { useEffect, useMemo, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@promptstudio/system/components/ui/select';
import {
  DRAFT_MODELS,
  RENDER_MODELS,
  formatCredits,
} from '../config/generationConfig';

interface GenerationHeaderProps {
  onDraft: (model: 'flux-kontext' | 'wan-2.2') => void;
  onRender: (model: string) => void;
  isDraftDisabled?: boolean;
  isRenderDisabled?: boolean;
  activeDraftModel?: string | null;
}

export function GenerationHeader({
  onDraft,
  onRender,
  isDraftDisabled = false,
  isRenderDisabled = false,
  activeDraftModel,
}: GenerationHeaderProps): React.ReactElement {
  const draftOptions = useMemo(() => Object.entries(DRAFT_MODELS), []);
  const renderOptions = useMemo(() => Object.entries(RENDER_MODELS), []);
  const [draftValue, setDraftValue] = useState<string | undefined>(
    activeDraftModel ?? undefined
  );
  const [renderValue, setRenderValue] = useState<string | undefined>(undefined);

  useEffect(() => {
    setDraftValue(activeDraftModel ?? undefined);
  }, [activeDraftModel]);

  return (
    <div className="flex h-ps-9 items-center gap-ps-3 overflow-x-auto px-ps-6">
      <div className="border-border flex items-center gap-2 rounded-lg border p-1">
        <Select
          value={draftValue}
          onValueChange={(value) => {
            setDraftValue(value);
            onDraft(value as 'flux-kontext' | 'wan-2.2');
          }}
          disabled={isDraftDisabled}
        >
          <SelectTrigger
            size="xxs"
            align="center"
            variant="filled"
            className="min-w-36"
            aria-label="Draft model selection"
          >
            <SelectValue placeholder="Draft" />
          </SelectTrigger>
          <SelectContent>
            {draftOptions.map(([id, config]) => (
              <SelectItem
                key={id}
                value={id}
                title={`${config.label} • ${formatCredits(config.credits)}`}
              >
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={renderValue}
          onValueChange={(value) => {
            setRenderValue(value);
            onRender(value);
          }}
          disabled={isRenderDisabled}
        >
          <SelectTrigger
            size="xxs"
            align="center"
            variant="accent"
            className="min-w-36"
            aria-label="Render model selection"
          >
            <SelectValue placeholder="Render" />
          </SelectTrigger>
          <SelectContent>
            {renderOptions.map(([id, config]) => (
              <SelectItem
                key={id}
                value={id}
                title={`${config.label} • ${formatCredits(config.credits)}`}
              >
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
