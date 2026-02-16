import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CaretDown,
  Star,
  WarningCircle,
} from "@promptstudio/system/components/ui";
import {
  VIDEO_DRAFT_MODEL,
  VIDEO_RENDER_MODELS,
} from "@components/ToolSidebar/config/modelConfig";
import { cn } from "@/utils/cn";
import type { ModelRecommendation } from "@/features/model-intelligence/types";
import { normalizeModelIdForSelection } from "@/features/model-intelligence/utils/modelLabels";

/* ── Types ── */

interface ModelEntry {
  id: string;
  label: string;
  cost: number;
  badge: "draft" | "render";
  badgeColor: string;
}

interface RecommendedEntry {
  model: ModelEntry;
  matchPct: number;
  isEfficient?: boolean | undefined;
  capabilities?: string[] | undefined;
}

interface UnavailableEntry {
  id: string;
  label: string;
  reason: string;
}

export interface ModelRecommendationDropdownProps {
  renderModelOptions: Array<{ id: string; label: string }>;
  renderModelId: string;
  onModelChange: (model: string) => void;
  modelRecommendation?: ModelRecommendation | null | undefined;
  recommendedModelId?: string | undefined;
  efficientModelId?: string | undefined;
  filteredOut?: Array<{ modelId: string; reason: string }> | undefined;
  triggerClassName?: string | undefined;
  triggerPrefixLabel?: string | undefined;
  triggerAriaLabel?: string | undefined;
}

/* ── Match bar ── */
function MatchBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1 w-12 overflow-hidden rounded-full bg-[#22252C]">
      <div
        className="h-full rounded-full transition-[width] duration-300"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

/* ── Helpers ── */

const FALLBACK_DRAFT_MODEL: ModelEntry = {
  ...VIDEO_DRAFT_MODEL,
  badge: "draft",
  badgeColor: "#4ADE80",
};

const buildModelEntries = (
  renderModelOptions: Array<{ id: string; label: string }>,
): ModelEntry[] => {
  const optionLabels = new Map(
    renderModelOptions.map((option) => [option.id, option.label]),
  );
  const hasOptionFilter = optionLabels.size > 0;

  const renderModels = VIDEO_RENDER_MODELS.filter(
    (model) => !hasOptionFilter || optionLabels.has(model.id),
  ).map((model) => ({
    ...model,
    label: optionLabels.get(model.id) ?? model.label,
    badge: "render" as const,
    badgeColor: "#6C5CE7",
  }));

  return [
    { ...VIDEO_DRAFT_MODEL, badge: "draft", badgeColor: "#4ADE80" },
    ...renderModels,
  ];
};

const findModel = (
  models: ModelEntry[],
  modelId: string,
): ModelEntry | undefined => models.find((model) => model.id === modelId);

function buildSections(
  models: ModelEntry[],
  recommendation: ModelRecommendation | null | undefined,
  recommendedModelId: string | undefined,
  efficientModelId: string | undefined,
  filteredOut: Array<{ modelId: string; reason: string }> | undefined,
): {
  recommended: RecommendedEntry[];
  other: ModelEntry[];
  unavailable: UnavailableEntry[];
} {
  const recIds = new Set<string>();
  const unavailableIds = new Set<string>();
  const recommended: RecommendedEntry[] = [];
  const unavailable: UnavailableEntry[] = [];

  // Build recommended list from recommendation data
  if (recommendation?.recommendations) {
    const sorted = [...recommendation.recommendations].sort(
      (a, b) => b.overallScore - a.overallScore,
    );
    for (const rec of sorted.slice(0, 2)) {
      const normalizedModelId = normalizeModelIdForSelection(rec.modelId);
      const model = findModel(models, normalizedModelId);
      if (!model) continue;
      recIds.add(model.id);
      recommended.push({
        model,
        matchPct: Math.round(rec.overallScore),
        isEfficient: normalizedModelId === efficientModelId,
        capabilities:
          normalizedModelId === recommendedModelId
            ? rec.strengths?.slice(0, 3)
            : undefined,
      });
    }
  }

  if (!recommended.length && recommendedModelId) {
    // Fallback: just mark the recommended model.
    const model = findModel(models, recommendedModelId);
    if (model) {
      recIds.add(model.id);
      recommended.push({
        model,
        matchPct: 85,
        isEfficient: recommendedModelId === efficientModelId,
      });
    }
  }

  // Build unavailable list
  if (filteredOut?.length) {
    for (const entry of filteredOut) {
      const normalizedModelId = normalizeModelIdForSelection(entry.modelId);
      const label =
        findModel(models, normalizedModelId)?.label ?? normalizedModelId;
      unavailableIds.add(normalizedModelId);
      unavailable.push({
        id: normalizedModelId,
        label,
        reason: entry.reason,
      });
    }
  }

  // Build "other" list: everything that's not recommended or unavailable
  const other = models.filter(
    (m) => !recIds.has(m.id) && !unavailableIds.has(m.id),
  );

  return { recommended, other, unavailable };
}

/* ── Main Component ── */

export function ModelRecommendationDropdown({
  renderModelOptions,
  renderModelId,
  onModelChange,
  modelRecommendation,
  recommendedModelId,
  efficientModelId,
  filteredOut,
  triggerClassName,
  triggerPrefixLabel,
  triggerAriaLabel,
}: ModelRecommendationDropdownProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const modelEntries = useMemo(
    () => buildModelEntries(renderModelOptions),
    [renderModelOptions],
  );

  const currentModel = useMemo(
    () =>
      findModel(modelEntries, renderModelId) ??
      findModel(modelEntries, VIDEO_DRAFT_MODEL.id) ??
      FALLBACK_DRAFT_MODEL,
    [modelEntries, renderModelId],
  );

  const { recommended, other, unavailable } = buildSections(
    modelEntries,
    modelRecommendation,
    recommendedModelId,
    efficientModelId,
    filteredOut ?? modelRecommendation?.filteredOut,
  );

  const handleSelect = useCallback(
    (id: string) => {
      onModelChange(id);
      setIsOpen(false);
    },
    [onModelChange],
  );

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      {/* ── Trigger button ── */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-lg border border-[#22252C] bg-[#16181E] px-3 text-xs font-semibold text-[#E2E6EF] transition-colors",
          "hover:border-[#3A3D46]",
          isOpen && "border-[#6C5CE7]",
          triggerClassName,
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={triggerAriaLabel ?? "Video model"}
      >
        {triggerPrefixLabel ? (
          <span className="text-[11px] font-medium text-[#555B6E]">{triggerPrefixLabel}</span>
        ) : null}
        {currentModel.label}
        <CaretDown
          className={cn(
            "h-2.5 w-2.5 text-[#8B92A5] transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {/* ── Dropdown (opens upward) ── */}
      {isOpen && (
        <div
          className="absolute bottom-[calc(100%+6px)] left-0 z-50 w-[264px] overflow-hidden rounded-xl border border-[#22252C] bg-[#16181E] shadow-[0_12px_40px_rgba(0,0,0,0.6)]"
          role="listbox"
          aria-label="Model selection"
        >
          {/* ── Recommended section ── */}
          {recommended.length > 0 && (
            <div className="px-1.5 pt-2.5 pb-1">
              <div className="flex items-center gap-1.5 px-2 pb-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-[#3A3E4C]">
                <Star className="h-2.5 w-2.5 text-[#FBBF24]" weight="fill" />
                Recommended for this prompt
              </div>

              {recommended.map((rec, i) => {
                const isTop = i === 0;
                const isSelected = rec.model.id === renderModelId;
                return (
                  <button
                    key={rec.model.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(rec.model.id)}
                    className={cn(
                      "mb-0.5 flex w-full flex-col gap-1 rounded-lg px-2 py-2 text-left text-xs transition-colors",
                      isTop
                        ? "border border-[#6C5CE733] bg-[#6C5CE70a]"
                        : "border border-transparent",
                      !isTop && isSelected && "bg-[#6C5CE712]",
                      !isTop && !isSelected && "hover:bg-[#22252C44]",
                    )}
                  >
                    {/* Top row */}
                    <div className="flex w-full items-center gap-1.5">
                      {isTop && (
                        <Star
                          className="h-2.5 w-2.5 flex-shrink-0 text-[#FBBF24]"
                          weight="fill"
                        />
                      )}
                      <span
                        className={cn(
                          "flex-1",
                          isTop
                            ? "font-bold text-[#E2E6EF]"
                            : isSelected
                              ? "font-semibold text-[#E2E6EF]"
                              : "font-normal text-[#8B92A5]",
                        )}
                      >
                        {rec.model.label}
                      </span>
                      {rec.isEfficient && (
                        <span className="rounded bg-[#16A34A26] px-1 py-[1px] text-[8px] font-semibold uppercase tracking-[0.04em] text-[#4ADE80]">
                          Efficient
                        </span>
                      )}
                      <span className="tabular-nums text-[10px] text-[#555B6E]">
                        {rec.matchPct}%
                      </span>
                      <MatchBar
                        pct={rec.matchPct}
                        color={isTop ? "#4ADE80" : "#6C5CE7"}
                      />
                      <span
                        className="text-[9px] font-semibold uppercase tracking-[0.05em] opacity-70"
                        style={{ color: rec.model.badgeColor }}
                      >
                        {rec.model.badge}
                      </span>
                      <span className="min-w-[30px] text-right tabular-nums text-[10px] text-[#3A3E4C]">
                        {rec.model.cost} cr
                      </span>
                    </div>

                    {/* Capability tags — only for top recommendation */}
                    {isTop &&
                      rec.capabilities &&
                      rec.capabilities.length > 0 && (
                        <div className="flex gap-1 pl-4">
                          {rec.capabilities.map((cap) => (
                            <span
                              key={cap}
                              className="rounded bg-[#22252C88] px-1.5 py-px text-[9px] leading-[1.4] text-[#555B6E]"
                            >
                              {cap}
                            </span>
                          ))}
                        </div>
                      )}
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Divider ── */}
          {recommended.length > 0 && other.length > 0 && (
            <div className="mx-3.5 h-px bg-[#22252C]" aria-hidden="true" />
          )}

          {/* ── Other models ── */}
          {other.length > 0 && (
            <div className="px-1.5 py-1">
              {other.map((model) => {
                const isSelected = model.id === renderModelId;
                return (
                  <button
                    key={model.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(model.id)}
                    className={cn(
                      "flex h-[34px] w-full items-center gap-2 rounded-md px-2 text-left text-xs transition-colors",
                      isSelected
                        ? "bg-[#6C5CE715] font-semibold text-[#E2E6EF]"
                        : "font-normal text-[#8B92A5] hover:bg-[#22252C44]",
                    )}
                  >
                    <span className="flex-1">{model.label}</span>
                    <span
                      className="text-[9px] font-semibold uppercase tracking-[0.05em] opacity-70"
                      style={{ color: model.badgeColor }}
                    >
                      {model.badge}
                    </span>
                    <span className="tabular-nums text-[10px] text-[#3A3E4C]">
                      {model.cost} cr
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Unavailable ── */}
          {unavailable.length > 0 && (
            <div className="px-1.5 pb-2">
              <div
                className="mx-2 mb-1.5 h-px bg-[#22252C]"
                aria-hidden="true"
              />
              {unavailable.map((entry) => (
                <div
                  key={entry.id}
                  className="flex h-[30px] items-center gap-1.5 px-2 text-[11px] text-[#3A3E4C]"
                >
                  <WarningCircle className="h-2.5 w-2.5 flex-shrink-0 text-[#FBBF24] opacity-60" />
                  <span>{entry.label}</span>
                  <div className="flex-1" />
                  <span className="text-[9px] italic text-[#3A3E4C]">
                    {entry.reason}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
