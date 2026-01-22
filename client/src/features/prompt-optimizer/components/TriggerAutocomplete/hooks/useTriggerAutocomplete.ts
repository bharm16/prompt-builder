import { useCallback, useEffect, useMemo, useState, type KeyboardEvent, type RefObject } from 'react';
import type { Asset } from '@shared/types/asset';

interface AutocompletePosition {
  top: number;
  left: number;
}

interface ActiveRange {
  start: number;
  end: number;
}

interface UseTriggerAutocompleteArgs {
  inputRef: RefObject<HTMLTextAreaElement>;
  prompt: string;
  assets: Asset[];
  onSelect: (asset: Asset, range: ActiveRange) => void;
  isEnabled?: boolean;
}

const TRIGGER_REGEX = /@([a-zA-Z][a-zA-Z0-9_-]*)?$/;
const MAX_SUGGESTIONS = 8;

const getCaretPosition = (
  input: HTMLTextAreaElement,
  position: number
): AutocompletePosition => {
  const rect = input.getBoundingClientRect();
  const style = window.getComputedStyle(input);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    return { top: rect.bottom + 6, left: rect.left };
  }

  context.font = `${style.fontStyle} ${style.fontVariant} ${style.fontWeight} ${style.fontSize} / ${style.lineHeight} ${style.fontFamily}`;
  const text = input.value.slice(0, position);
  const textWidth = context.measureText(text).width;
  const paddingLeft = parseFloat(style.paddingLeft) || 0;
  const borderLeft = parseFloat(style.borderLeftWidth) || 0;

  return {
    top: rect.bottom + 6,
    left: rect.left + paddingLeft + borderLeft + textWidth - input.scrollLeft,
  };
};

export function useTriggerAutocomplete({
  inputRef,
  prompt,
  assets,
  onSelect,
  isEnabled = true,
}: UseTriggerAutocompleteArgs) {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Asset[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState<AutocompletePosition>({ top: 0, left: 0 });
  const [activeRange, setActiveRange] = useState<ActiveRange | null>(null);

  const assetLookup = useMemo(
    () =>
      assets.map((asset) => ({
        asset,
        normalized: asset.trigger.replace(/^@/, '').toLowerCase(),
      })),
    [assets]
  );

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setSuggestions([]);
    setActiveRange(null);
  }, []);

  const updateFromCursor = useCallback(() => {
    if (!isEnabled) {
      close();
      return;
    }

    const input = inputRef.current;
    if (!input) {
      return;
    }

    const cursor = input.selectionStart ?? 0;
    const currentText = input.value;
    const beforeCursor = currentText.slice(0, cursor);
    const match = beforeCursor.match(TRIGGER_REGEX);

    if (!match) {
      close();
      return;
    }

    const matchedQuery = match[1] ?? '';
    const start = match.index ?? beforeCursor.lastIndexOf('@');
    if (start < 0) {
      close();
      return;
    }

    const normalizedQuery = matchedQuery.toLowerCase();
    const filtered = normalizedQuery
      ? assetLookup
          .filter(({ normalized }) => normalized.startsWith(normalizedQuery))
          .map(({ asset }) => asset)
      : assetLookup.map(({ asset }) => asset);

    setQuery(matchedQuery);
    setSuggestions(filtered.slice(0, MAX_SUGGESTIONS));
    setSelectedIndex(0);
    setIsOpen(true);
    setActiveRange({ start, end: cursor });
    setPosition(getCaretPosition(input, cursor));
  }, [assetLookup, close, inputRef, isEnabled, prompt]);

  useEffect(() => {
    updateFromCursor();
  }, [updateFromCursor]);

  const selectSuggestion = useCallback(
    (index: number): void => {
      const asset = suggestions[index];
      if (!asset || !activeRange) return;
      onSelect(asset, activeRange);
      close();
    },
    [activeRange, close, onSelect, suggestions]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (!isOpen || suggestions.length === 0) return false;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setSelectedIndex((index) => Math.min(index + 1, suggestions.length - 1));
          return true;
        case 'ArrowUp':
          event.preventDefault();
          setSelectedIndex((index) => Math.max(index - 1, 0));
          return true;
        case 'Enter':
        case 'Tab':
          event.preventDefault();
          selectSuggestion(selectedIndex);
          return true;
        case 'Escape':
          event.preventDefault();
          close();
          return true;
        default:
          return false;
      }
    },
    [close, isOpen, selectSuggestion, selectedIndex, suggestions.length]
  );

  return {
    isOpen,
    suggestions,
    selectedIndex,
    position,
    query,
    handleKeyDown,
    selectSuggestion,
    setSelectedIndex,
    close,
    updateFromCursor,
  };
}

export default useTriggerAutocomplete;
