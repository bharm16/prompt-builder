import React from "react";
import { cn } from "@/utils/cn";
import { TUNE_CHIPS, type TuneChip, type TuneChipId } from "../utils/tuneChips";

export interface TuneDrawerProps {
  selectedChipIds: ReadonlyArray<TuneChipId>;
  onToggleChip: (id: TuneChipId) => void;
  onClose: () => void;
}

const SECTIONS: ReadonlyArray<{ id: TuneChip["section"]; label: string }> = [
  { id: "motion", label: "Motion" },
  { id: "mood", label: "Mood" },
  { id: "style", label: "Style" },
];

export function TuneDrawer({
  selectedChipIds,
  onToggleChip,
  onClose,
}: TuneDrawerProps): React.ReactElement {
  const selected = new Set(selectedChipIds);
  return (
    <div
      className="border-b border-tool-rail-border px-4 pb-3 pt-3"
      role="region"
      aria-label="Tune render settings"
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="m-0 text-xs font-semibold uppercase tracking-wider text-tool-text-subdued">
          Tune
        </h3>
        <button
          type="button"
          aria-label="Close"
          className="rounded-md px-2 py-0.5 text-xs text-tool-text-subdued hover:bg-tool-rail-border"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {SECTIONS.map((section) => {
          const chipsForSection = TUNE_CHIPS.filter(
            (c) => c.section === section.id,
          );
          return (
            <fieldset
              key={section.id}
              className="m-0 flex items-center gap-2 border-0 p-0"
            >
              <legend className="contents">
                <span className="mr-1 inline-block w-[44px] font-mono text-[10px] uppercase tracking-wider text-tool-text-subdued">
                  {section.label}
                </span>
              </legend>
              {chipsForSection.map((chip) => {
                const isPressed = selected.has(chip.id);
                return (
                  <button
                    key={chip.id}
                    type="button"
                    aria-pressed={isPressed}
                    onClick={() => onToggleChip(chip.id)}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                      isPressed
                        ? "border-tool-accent-neutral/50 bg-tool-accent-neutral/10 text-foreground"
                        : "border-tool-rail-border bg-transparent text-tool-text-dim hover:border-tool-text-label hover:text-foreground",
                    )}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}
