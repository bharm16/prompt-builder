import { useCallback } from 'react';
import { applySuggestionToPrompt } from '../../utils/applySuggestion.js';
import { fetchEnhancementSuggestions as fetchSuggestionsAPI } from '../../api/enhancementSuggestionsApi';
import { useEditHistory } from '../../hooks/useEditHistory';

/**
 * Find spans that are near the selected text
 * @param {Object} metadata - Metadata for selected span
 * @param {Array} allSpans - All labeled spans
 * @param {number} threshold - Distance threshold in characters
 * @returns {Array} Nearby spans with distance info
 */
function findNearbySpans(metadata, allSpans, threshold = 100) {
  if (!metadata || !Array.isArray(allSpans) || allSpans.length === 0) {
    return [];
  }

  const selectedStart = metadata.start ?? -1;
  const selectedEnd = metadata.end ?? -1;

  if (selectedStart < 0 || selectedEnd < 0) {
    return [];
  }

  return allSpans
    .filter((span) => {
      // Don't include the selected span itself
      if (span.start === selectedStart && span.end === selectedEnd) {
        return false;
      }

      // Calculate distance
      const distanceBefore = selectedStart - span.end;
      const distanceAfter = span.start - selectedEnd;

      // Include if within threshold (before or after)
      return (distanceBefore >= 0 && distanceBefore <= threshold) ||
             (distanceAfter >= 0 && distanceAfter <= threshold);
    })
    .map((span) => {
      // Calculate exact distance
      const distanceBefore = selectedStart - span.end;
      const distanceAfter = span.start - selectedEnd;
      const distance = distanceBefore >= 0 ? distanceBefore : distanceAfter;
      const position = distanceBefore >= 0 ? 'before' : 'after';

      return {
        text: (span.quote || span.text || '').trim(),
        role: span.role || span.category || 'unknown',
        category: span.category || span.role || 'unknown',
        confidence: span.confidence,
        distance,
        position,
        start: span.start,
        end: span.end,
      };
    })
    .filter((span) => span.text) // Filter out spans with empty text
    .sort((a, b) => a.distance - b.distance); // Sort by proximity
}

/**
 * Custom hook for enhancement suggestions
 * Handles fetching and applying suggestions for highlighted text
 */
export function useEnhancementSuggestions({
  promptOptimizer,
  selectedMode,
  suggestionsData,
  setSuggestionsData,
  setDisplayedPromptSilently,
  stablePromptContext,
  toast,
}) {
  // Initialize edit history tracking
  const { addEdit, getEditSummary } = useEditHistory();

  /**
   * Handle suggestion click - apply suggestion to prompt
   */
  const handleSuggestionClick = useCallback(async (suggestion) => {
    const suggestionText =
      typeof suggestion === 'string' ? suggestion : suggestion?.text || '';

    if (!suggestionText || !suggestionsData) return;

    const {
      selectedText,
      fullPrompt,
      range,
      offsets,
      metadata,
    } = suggestionsData;

    try {
      // Apply the suggestion (delegates to utility)
      const result = await applySuggestionToPrompt({
        currentPrompt: fullPrompt,
        selectedText,
        suggestionText,
        range,
        offsets,
        metadata,
      });

      // Update displayed prompt
      if (result.updatedPrompt) {
        setDisplayedPromptSilently(result.updatedPrompt);
        toast.success('Suggestion applied');

        // Track this edit in history
        addEdit({
          original: selectedText,
          replacement: suggestionText,
          category: metadata?.category || metadata?.span?.category || null,
          position: offsets?.start || null,
          confidence: metadata?.confidence || metadata?.span?.confidence || null,
        });
      }

      // Close suggestions panel
      setSuggestionsData(null);
    } catch (error) {
      console.error('Error applying suggestion:', error);
      toast.error('Failed to apply suggestion');
    }
  }, [suggestionsData, setDisplayedPromptSilently, setSuggestionsData, toast, addEdit]);

  /**
   * Fetch enhancement suggestions for highlighted text
   */
  const fetchEnhancementSuggestions = useCallback(async (payload = {}) => {
    const {
      highlightedText,
      originalText,
      displayedPrompt: payloadPrompt,
      range,
      offsets,
      metadata: rawMetadata = null,
      trigger = 'highlight',
      allLabeledSpans = [], // NEW: Complete span context from labeling
    } = payload;

    // CRITICAL: Validate and sanitize input spans immediately
    // Filter out any spans with empty/invalid text before processing
    const sanitizedInputSpans = (allLabeledSpans || []).filter(span => {
      if (!span || typeof span !== 'object') return false;
      const text = span.quote || span.text || '';
      return typeof text === 'string' && text.trim().length > 0;
    });

    const trimmedHighlight = (highlightedText || '').trim();
    const rawPrompt = payloadPrompt ?? promptOptimizer.displayedPrompt ?? '';
    const normalizedPrompt = rawPrompt.normalize('NFC');
    const metadata = rawMetadata
      ? {
          ...rawMetadata,
          span: rawMetadata.span ? { ...rawMetadata.span } : null,
        }
      : null;

    // Early returns for invalid cases
    if (selectedMode !== 'video' || !trimmedHighlight) {
      return;
    }

    if (suggestionsData?.selectedText === trimmedHighlight && suggestionsData?.show) {
      return;
    }

    // Show loading state immediately
    setSuggestionsData({
      show: true,
      selectedText: trimmedHighlight,
      originalText: originalText || trimmedHighlight,
      suggestions: [],
      isLoading: true,
      isPlaceholder: false,
      fullPrompt: normalizedPrompt,
      range,
      offsets,
      metadata,
      setSuggestions: (newSuggestions, newIsPlaceholder) => {
        setSuggestionsData((prev) => ({
          ...prev,
          suggestions: newSuggestions,
          isPlaceholder:
            newIsPlaceholder !== undefined
              ? newIsPlaceholder
              : prev.isPlaceholder,
        }));
      },
      onSuggestionClick: handleSuggestionClick,
      onClose: () => setSuggestionsData(null),
    });

    try {
      // Build simplified spans with defensive mapping
      // Map first, then filter the results to ensure no empty text
      const simplifiedSpans = sanitizedInputSpans
        .map(span => {
          if (!span || typeof span !== 'object') return null;
          
          const text = (span.quote || span.text || '').trim();
          
          // Skip this span if text is empty after trimming
          if (!text || text.length === 0) return null;
          
          return {
            text: text,
            role: span.role || span.category || 'unknown',
            category: span.category || span.role || 'unknown',
            confidence: span.confidence,
            start: span.start,
            end: span.end,
          };
        })
        .filter(span => span !== null && span.text && span.text.length > 0);

      // Find nearby spans using the already-validated simplified spans
      const nearbySpans = findNearbySpans(metadata, sanitizedInputSpans, 100)
        .filter(span => span.text && span.text.length > 0);

      // Get edit history for context
      const editHistory = getEditSummary(10); // Last 10 edits

      // DEBUG: Log what we're actually sending
      console.log('🔍 Sending to API:', {
        simplifiedSpansCount: simplifiedSpans.length,
        nearbySpansCount: nearbySpans.length,
        firstSimplifiedSpan: simplifiedSpans[0],
        firstNearbySpan: nearbySpans[0],
        hasEmptySpans: simplifiedSpans.some(s => !s.text || s.text.length === 0),
        hasEmptyNearby: nearbySpans.some(s => !s.text || s.text.length === 0),
        // Check EVERY span for empty text
        emptySpanIndices: simplifiedSpans.map((s, i) => !s.text || s.text.length === 0 ? i : -1).filter(i => i !== -1),
        emptyNearbyIndices: nearbySpans.map((s, i) => !s.text || s.text.length === 0 ? i : -1).filter(i => i !== -1),
        // Show the actual empty spans
        emptySpans: simplifiedSpans.filter(s => !s.text || s.text.length === 0),
        emptyNearbySpans: nearbySpans.filter(s => !s.text || s.text.length === 0),
      });

      // Delegate to API layer (VideoConceptBuilder pattern)
      const { suggestions, isPlaceholder } = await fetchSuggestionsAPI({
        highlightedText: trimmedHighlight,
        normalizedPrompt,
        inputPrompt: promptOptimizer.inputPrompt,
        brainstormContext: stablePromptContext,
        metadata,
        allLabeledSpans: simplifiedSpans,
        nearbySpans: nearbySpans,
        editHistory, // NEW: Edit history for consistency
      });

      // Update with results
      setSuggestionsData(prev => ({
        ...prev,
        suggestions,
        isLoading: false,
        isPlaceholder,
      }));
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      toast.error('Failed to load suggestions');

      setSuggestionsData((prev) => ({
        ...prev,
        isLoading: false,
        suggestions: [{ text: 'Failed to load suggestions. Please try again.' }],
      }));
    }
  }, [
    promptOptimizer,
    selectedMode,
    suggestionsData,
    setSuggestionsData,
    stablePromptContext,
    toast,
    handleSuggestionClick,
    getEditSummary,
  ]);

  return {
    fetchEnhancementSuggestions,
    handleSuggestionClick,
  };
}

