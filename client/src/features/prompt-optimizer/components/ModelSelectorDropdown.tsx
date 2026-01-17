import React, { useState, useRef, useEffect, memo, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Video } from 'lucide-react';
import { Button } from '@promptstudio/system/components/ui/button';
import { AI_MODEL_IDS, AI_MODEL_LABELS, AI_MODEL_PROVIDERS } from './constants';
import { useModelRegistry } from '../hooks/useModelRegistry';

/**
 * Model selector dropdown for selecting specific video models
 */
export const ModelSelectorDropdown = memo<{
  selectedModel: string | undefined;
  onModelChange: (modelId: string) => void;
  disabled?: boolean;
  variant?: 'default' | 'pill' | 'pillDark';
  prefixLabel?: string;
}>(({ selectedModel, onModelChange, disabled = false, variant = 'default', prefixLabel }): React.ReactElement => {
  const [isOpen, setIsOpen] = useState(false);
  const { models: availableModels, isLoading } = useModelRegistry();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; placement: 'bottom' | 'top' } | null>(
    null
  );

  const resolveModelMeta = (modelId: string): { strength: string; badges: Array<string> } => {
    const id = modelId.toLowerCase();
    if (id.includes('sora')) {
      return { strength: 'Cinematic motion and high fidelity', badges: ['Cinematic', 'Photoreal'] };
    }
    if (id.includes('veo')) {
      return { strength: 'Strong lighting, realism, and camera', badges: ['Cinematic', 'Photoreal'] };
    }
    if (id.includes('kling')) {
      return { strength: 'Stable subjects and dynamic movement', badges: ['Cinematic', 'Character'] };
    }
    if (id.includes('luma')) {
      return { strength: 'Fast, clean previews with realism', badges: ['Fast', 'Photoreal'] };
    }
    if (id.includes('runway')) {
      return { strength: 'Quick iterations with strong style', badges: ['Fast', 'Cinematic'] };
    }
    if (id.includes('wan')) {
      return { strength: 'Speedy motion checks for iteration', badges: ['Fast', 'Balanced'] };
    }
    return { strength: 'Balanced preview defaults', badges: ['Balanced'] };
  };

  // Use Prompt Studio system badges (keeps menu consistent with the rest of PromptCanvas).
  const badgeClass = 'po-badge';
  const accentBadgeClass = 'po-badge po-badge--best';
  
  // Find label for current selection
  const fallbackModelOptions = useMemo(() => {
    return [...AI_MODEL_IDS]
      .map((id) => ({
        id,
        label: AI_MODEL_LABELS[id as keyof typeof AI_MODEL_LABELS] ?? id,
        provider: AI_MODEL_PROVIDERS[id as keyof typeof AI_MODEL_PROVIDERS] ?? 'unknown',
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, []);

  const effectiveModels = availableModels.length ? availableModels : fallbackModelOptions;

  const selectedOption = effectiveModels.find(m => m.id === selectedModel);
  const currentLabel =
    selectedOption?.label ??
    (selectedModel
      ? AI_MODEL_LABELS[selectedModel as keyof typeof AI_MODEL_LABELS] || selectedModel
      : 'Auto (Recommended)');

  // UI polish: keep labels compact in tight control bars
  const displayLabel = currentLabel.replace(/\s*\(recommended\)\s*/i, '').trim();

  // Handle clicks outside dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      const target = event.target as Node;
      if (dropdownRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      if (isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
    return undefined;
  }, [isOpen]);

  const computeMenuPosition = useMemo(() => {
    return (): { top: number; left: number; placement: 'bottom' | 'top' } | null => {
      const button = buttonRef.current;
      if (!button) return null;
      const rect = button.getBoundingClientRect();
      const viewportMargin = 8;
      const preferredLeft = rect.left;
      const maxLeft = Math.max(viewportMargin, window.innerWidth - 260 - viewportMargin);
      const left = Math.max(viewportMargin, Math.min(preferredLeft, maxLeft));
      const top = rect.bottom + 8;
      return { top, left, placement: 'bottom' };
    };
  }, []);

  // Position the portal menu so it isn't clipped by overflow containers.
  useEffect(() => {
    if (!isOpen) {
      setMenuPosition(null);
      return;
    }
    const next = computeMenuPosition();
    setMenuPosition(next);
    const handleReposition = (): void => {
      setMenuPosition(computeMenuPosition());
    };
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);
    return () => {
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, [isOpen, computeMenuPosition]);

  // Track if we've already flipped to prevent re-render loops
  const hasFlippedRef = useRef(false);

  // If the menu would run offscreen, flip it upward.
  useEffect(() => {
    if (!isOpen) {
      hasFlippedRef.current = false;
      return;
    }
    if (!menuPosition) return;
    // Already flipped for this open state, skip
    if (hasFlippedRef.current) return;
    const el = menuRef.current;
    const button = buttonRef.current;
    if (!el || !button) return;
    const rect = button.getBoundingClientRect();
    const viewportMargin = 8;
    const menuHeight = el.getBoundingClientRect().height;
    const wouldOverflowBottom = menuPosition.top + menuHeight + viewportMargin > window.innerHeight;
    if (!wouldOverflowBottom) return;
    const nextTop = Math.max(viewportMargin, rect.top - menuHeight - 8);
    hasFlippedRef.current = true;
    setMenuPosition({ top: nextTop, left: menuPosition.left, placement: 'top' });
  }, [isOpen, menuPosition]);

  useEffect(() => {
    if (disabled && isOpen) {
      setIsOpen(false);
    }
  }, [disabled, isOpen]);

  const handleModelSelect = (modelId: string): void => {
    onModelChange(modelId);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef} data-variant={variant}>
      <Button
        type="button"
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
          }
        }}
        ref={buttonRef}
        disabled={disabled}
        className="po-model-select"
        data-open={isOpen ? 'true' : 'false'}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`${prefixLabel ? `${prefixLabel}. ` : ''}Current model: ${currentLabel}`}
        aria-disabled={disabled}
        aria-busy={isLoading}
        variant="ghost"
      >
        {prefixLabel && <span className="po-model-select__prefix">{prefixLabel}</span>}
        <Video className="po-model-select__icon h-3.5 w-3.5" />
        <span className="po-model-select__label">{isLoading ? 'Loading…' : displayLabel}</span>
        <ChevronDown
          className="po-model-select__chev h-3.5 w-3.5"
          aria-hidden="true"
        />
      </Button>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            className="po-model-menu po-popover po-surface po-surface--grad po-animate-pop-in"
            style={{
              top: `${menuPosition?.top ?? 0}px`,
              left: `${menuPosition?.left ?? 0}px`,
              visibility: menuPosition ? 'visible' : 'hidden',
            }}
            role="listbox"
            aria-label="Available video models"
            data-placement={menuPosition?.placement ?? 'bottom'}
          >
            {/* Auto-detect Option */}
            <Button
              type="button"
              onClick={() => handleModelSelect('')}
              className="po-model-menu__item"
              data-selected={!selectedModel ? 'true' : 'false'}
              role="option"
              aria-selected={!selectedModel}
              variant="ghost"
            >
              <div className="po-model-menu__text">
                <div className="po-model-menu__name">Auto (Recommended)</div>
                <div className="po-model-menu__meta">Picks the best model for the prompt</div>
                <div className="po-model-menu__badges">
                  <span className={accentBadgeClass}>Recommended</span>
                  <span className={badgeClass}>Balanced</span>
                </div>
              </div>
              {!selectedModel && (
                <Check className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>

            {/* Model Options */}
            {effectiveModels.map((option) => {
              const isSelected = option.id === selectedModel;
              const meta = resolveModelMeta(option.id);

              return (
                <Button
                  key={option.id}
                  type="button"
                  onClick={() => handleModelSelect(option.id)}
                  className="po-model-menu__item"
                  data-selected={isSelected ? 'true' : 'false'}
                  role="option"
                  aria-selected={isSelected}
                  variant="ghost"
                >
                  <div className="po-model-menu__text">
                    <div className="po-model-menu__name">{option.label}</div>
                    <div className="po-model-menu__provider">{option.provider}</div>
                    <div className="po-model-menu__meta">{meta.strength}</div>
                    <div className="po-model-menu__badges">
                      {meta.badges.map((badge) => (
                        <span key={badge} className={badgeClass}>
                          {badge}
                        </span>
                      ))}
                    </div>
                  </div>
                  {isSelected && (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  )}
                </Button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
});

ModelSelectorDropdown.displayName = 'ModelSelectorDropdown';
