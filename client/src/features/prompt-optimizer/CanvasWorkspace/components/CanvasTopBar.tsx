import React from 'react';
import { ChevronDown } from '@promptstudio/system/components/ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@promptstudio/system/components/ui/select';
import type { PromptVersionEntry } from '@/hooks/types';
import { formatTimestamp } from '@/features/prompt-optimizer/PromptCanvas/utils/promptCanvasFormatters';

interface CanvasTopBarProps {
  title?: string;
  sessionName?: string;
  credits?: number | null;
  versions?: PromptVersionEntry[] | undefined;
  selectedVersionId?: string | undefined;
  onSelectVersion?: ((versionId: string) => void) | undefined;
}

const resolveVersionLabel = (
  entry: PromptVersionEntry,
  index: number,
  total: number
): string => {
  if (typeof entry.label === 'string' && entry.label.trim().length > 0) {
    return entry.label.trim();
  }
  return `v${total - index}`;
};

const resolveTimestampLabel = (entry: PromptVersionEntry): string => {
  const parsed = Date.parse(entry.timestamp);
  if (Number.isNaN(parsed)) return '';
  return formatTimestamp(parsed);
};

export function CanvasTopBar({
  title = 'Vidra',
  sessionName = 'Untitled session',
  credits,
  versions,
  selectedVersionId,
  onSelectVersion,
}: CanvasTopBarProps): React.ReactElement {
  const hasVersionSelector = Boolean(
    versions && versions.length > 0 && selectedVersionId && onSelectVersion
  );
  const activeVersionLabel = hasVersionSelector
    ? resolveVersionLabel(
        versions!.find((entry) => entry.versionId === selectedVersionId) ?? versions![0]!,
        0,
        versions!.length
      )
    : null;

  return (
    <div className="flex h-12 flex-shrink-0 items-center gap-3 px-4">
      <span className="text-[15.4px] font-bold tracking-tight text-[#E2E6EF]">
        {title}
      </span>

      <div className="flex-1" />

      <button
        type="button"
        className="inline-flex items-center gap-1 text-[11px] text-[#8B92A5] transition-colors hover:text-[#C0C5D4]"
      >
        {sessionName}
        <ChevronDown size={10} />
      </button>

      {hasVersionSelector ? (
        <>
          <div className="mx-1 h-4 w-px bg-[#1A1C22]" />
          <Select
            value={selectedVersionId!}
            onValueChange={onSelectVersion!}
          >
            <SelectTrigger
              size="xs"
              variant="ghost"
              className="h-7 min-w-16 max-w-44 justify-start rounded-md px-2 text-[11px] font-medium text-[#8B92A5] transition-colors hover:bg-[#141519] hover:text-[#C0C5D4] [&>span]:!flex [&>span]:overflow-visible"
              aria-label={`Prompt version: ${activeVersionLabel ?? 'selected'}`}
            >
              <span className="flex min-w-0 items-center gap-1">
                <span className="truncate text-[11px]">{activeVersionLabel}</span>
              </span>
            </SelectTrigger>
            <SelectContent align="end" className="max-h-72">
              {versions!.map((entry, index) => {
                const label = resolveVersionLabel(entry, index, versions!.length);
                const meta = resolveTimestampLabel(entry);
                return (
                  <SelectItem key={entry.versionId} value={entry.versionId}>
                    {meta ? `${label} · ${meta}` : label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </>
      ) : null}

      <div className="mx-1 h-4 w-px bg-[#1A1C22]" />

      {typeof credits === 'number' ? (
        <span className="inline-flex items-center gap-1.5 text-xs text-[#8B92A5]">
          <span className="h-[5px] w-[5px] rounded-full bg-[#4ADE80]" />
          {credits} credits
        </span>
      ) : null}
    </div>
  );
}
