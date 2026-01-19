import React, { useEffect, useMemo, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@promptstudio/system/components/ui/select';
import { DRAFT_MODELS, RENDER_MODELS, formatCost } from '../config/generationConfig';
import { cn } from '@/utils/cn';

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
  const [draftValue, setDraftValue] = useState<string | undefined>(activeDraftModel ?? undefined);
  const [renderValue, setRenderValue] = useState<string | undefined>(undefined);

  useEffect(() => {
    setDraftValue(activeDraftModel ?? undefined);
  }, [activeDraftModel]);

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
      <div className="flex items-center gap-2">
        <Select
          value={draftValue}
          onValueChange={(value) => {
            setDraftValue(value);
            onDraft(value as 'flux-kontext' | 'wan-2.2');
          }}
          disabled={isDraftDisabled}
        >
          <SelectTrigger
            className={cn(
              'h-9 min-w-[140px] rounded-lg border border-border bg-surface-2 text-label-sm font-semibold',
              'hover:border-border-strong hover:bg-surface-3'
            )}
            aria-label="Draft model selection"
          >
            <SelectValue placeholder="Draft" />
          </SelectTrigger>
          <SelectContent>
            {draftOptions.map(([id, config]) => (
              <SelectItem key={id} value={id} title={`${config.label} • ${formatCost(config.cost)}`}>
                <div className="flex flex-col">
                  <span className="text-body-sm font-semibold text-foreground">{config.label}</span>
                  <span className="text-label-sm text-muted">
                    {formatCost(config.cost)} • {config.eta}
                    {config.frameCount ? ` • ${config.frameCount} frames` : ''}
                  </span>
                </div>
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
            className={cn(
              'h-9 min-w-[140px] rounded-lg border border-border bg-surface-2 text-label-sm font-semibold',
              'hover:border-border-strong hover:bg-surface-3'
            )}
            aria-label="Render model selection"
          >
            <SelectValue placeholder="Render" />
          </SelectTrigger>
          <SelectContent>
            {renderOptions.map(([id, config]) => (
              <SelectItem key={id} value={id} title={`${config.label} • ${formatCost(config.cost)}`}>
                <div className="flex flex-col">
                  <span className="text-body-sm font-semibold text-foreground">{config.label}</span>
                  <span className="text-label-sm text-muted">
                    {formatCost(config.cost)} • {config.eta}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
