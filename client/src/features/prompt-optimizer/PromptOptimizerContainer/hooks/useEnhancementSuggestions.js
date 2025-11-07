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
      // CRITICAL: Filter spans FIRST before any processing
      // This prevents sending empty spans to any API endpoint
      const validSpans = sanitizedInputSpans.filter(span => {
        if (!span) return false;
        const text = span.quote || span.text || '';
        return typeof text === 'string' && text.trim().length > 0;
      });

      // Find nearby spans for contextual awareness (using filtered spans)
      const nearbySpans = findNearbySpans(metadata, validSpans, 100);

      // Prepare all labeled spans for API (simplified for transmission)
      const simplifiedSpans = validSpans.map(span => ({
        text: (span.quote || span.text || '').trim(),
        role: span.role || span.category || 'unknown',
        category: span.category || span.role || 'unknown',
        confidence: span.confidence,
        start: span.start,
        end: span.end,
      }));

      // Get edit history for context
      const editHistory = getEditSummary(10); // Last 10 edits

      // FINAL DEFENSIVE CHECK: Ensure no empty spans slip through
      const finalSimplifiedSpans = simplifiedSpans.filter(s => s.text && s.text.length > 0);
      const finalNearbySpans = nearbySpans.filter(s => s.text && s.text.length > 0);

      // ONLY send labeled spans if we have valid ones
      // Don't send empty/incomplete spans - backend will work without them
      const shouldSendSpans = finalSimplifiedSpans.length > 0 && 
                              finalSimplifiedSpans.every(s => s.text && s.text.length > 0);

      // Delegate to API layer (VideoConceptBuilder pattern)
      const { suggestions, isPlaceholder } = await fetchSuggestionsAPI({
        highlightedText: trimmedHighlight,
        normalizedPrompt,
        inputPrompt: promptOptimizer.inputPrompt,
        brainstormContext: stablePromptContext,
        metadata,
        allLabeledSpans: [],
        nearbySpans: [],
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

