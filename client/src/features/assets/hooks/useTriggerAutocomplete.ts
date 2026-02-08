import { useState, useCallback, useEffect, useMemo } from 'react';
import type { KeyboardEvent } from 'react';
import debounce from 'lodash/debounce';
import { logger } from '@/services/LoggingService';
import { assetApi } from '../api/assetApi';

export interface AssetSuggestion {
  id: string;
  type: string;
  trigger: string;
  name: string;
  thumbnailUrl?: string | undefined;
}

interface AutocompletePosition {
  top: number;
  left: number;
}

interface TriggerDetection {
  triggered: boolean;
  query?: string | undefined;
  startIndex?: number | undefined;
  endIndex?: number | undefined;
}

interface TriggerAutocompleteOptions {
  debounceMs?: number;
}

export function useTriggerAutocomplete(options: TriggerAutocompleteOptions = {}) {
  const { debounceMs = 150 } = options;

  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<AssetSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState<AutocompletePosition>({ top: 0, left: 0 });
  const [isLoading, setIsLoading] = useState(false);

  const fetchSuggestions = useMemo(
    () =>
      debounce(async (searchQuery: string) => {
        if (!searchQuery) {
          setSuggestions([]);
          return;
        }

        setIsLoading(true);
        try {
          const results = await assetApi.getSuggestions(searchQuery);
          setSuggestions(results);
          setSelectedIndex(0);
        } catch (error) {
          logger.warn('Failed to fetch asset suggestions', { error: error instanceof Error ? error.message : String(error) });
          setSuggestions([]);
        } finally {
          setIsLoading(false);
        }
      }, debounceMs),
    [debounceMs]
  );

  useEffect(() => {
    return () => {
      fetchSuggestions.cancel();
    };
  }, [fetchSuggestions]);

  const detectTrigger = useCallback((text: string, cursorPosition: number): TriggerDetection => {
    const beforeCursor = text.slice(0, cursorPosition);
    const match = beforeCursor.match(/@([a-zA-Z0-9_]*)$/);

    if (match) {
      return {
        triggered: true,
        query: match[1],
        startIndex: match.index,
        endIndex: cursorPosition,
      };
    }

    return { triggered: false };
  }, []);

  const handleInputChange = useCallback(
    (
      text: string,
      cursorPosition: number,
      inputElement?: HTMLElement | null,
      caretRect?: DOMRect | null
    ): TriggerDetection => {
      const detection = detectTrigger(text, cursorPosition);

      if (detection.triggered) {
        setQuery(detection.query || '');
        setIsOpen(true);
        fetchSuggestions(detection.query || '');

        if (caretRect) {
          setPosition({
            top: caretRect.bottom + window.scrollY + 6,
            left: caretRect.left + window.scrollX,
          });
        } else if (inputElement) {
          const rect = inputElement.getBoundingClientRect();
          setPosition({
            top: rect.bottom + window.scrollY + 6,
            left: rect.left + window.scrollX,
          });
        }
      } else {
        setIsOpen(false);
        setQuery('');
        setSuggestions([]);
      }

      return detection;
    },
    [detectTrigger, fetchSuggestions]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent): false | true | { selected: AssetSuggestion } => {
      if (!isOpen || suggestions.length === 0) return false;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((index) => Math.min(index + 1, suggestions.length - 1));
          return true;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((index) => Math.max(index - 1, 0));
          return true;
        case 'Enter':
        case 'Tab':
          if (suggestions[selectedIndex]) {
            e.preventDefault();
            return { selected: suggestions[selectedIndex] };
          }
          return false;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          return true;
        default:
          return false;
      }
    },
    [isOpen, suggestions, selectedIndex]
  );

  const selectSuggestion = useCallback((suggestion: AssetSuggestion) => {
    setIsOpen(false);
    setQuery('');
    setSuggestions([]);
    return suggestion;
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setSuggestions([]);
  }, []);

  return {
    isOpen,
    suggestions,
    selectedIndex,
    query,
    position,
    isLoading,
    handleInputChange,
    handleKeyDown,
    selectSuggestion,
    setSelectedIndex,
    close,
  };
}

export default useTriggerAutocomplete;
