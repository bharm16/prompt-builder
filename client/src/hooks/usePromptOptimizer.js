import { useState, useCallback } from 'react';
import { useToast } from '../components/Toast';
import { promptOptimizationApi } from '../services';
import { promptOptimizationApiV2 } from '../services/PromptOptimizationApi';

// Simple logger for client-side debugging
const logger = {
  debug: (msg, data) => console.debug(`[usePromptOptimizer] ${msg}`, data),
  info: (msg, data) => console.info(`[usePromptOptimizer] ${msg}`, data),
  warn: (msg, data) => console.warn(`[usePromptOptimizer] ${msg}`, data),
  error: (msg, data) => console.error(`[usePromptOptimizer] ${msg}`, data),
};

export const usePromptOptimizer = (selectedMode, useTwoStage = true) => {
  const [inputPrompt, setInputPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [optimizedPrompt, setOptimizedPrompt] = useState('');
  const [displayedPrompt, setDisplayedPrompt] = useState('');
  const [qualityScore, setQualityScore] = useState(null);
  const [skipAnimation, setSkipAnimation] = useState(false);
  const [improvementContext, setImprovementContext] = useState(null);

  // Two-stage optimization states
  const [draftPrompt, setDraftPrompt] = useState('');
  const [isDraftReady, setIsDraftReady] = useState(false);
  const [isRefining, setIsRefining] = useState(false);

  // Span labeling states for highlighting
  const [draftSpans, setDraftSpans] = useState(null);
  const [refinedSpans, setRefinedSpans] = useState(null);

  const toast = useToast();

  const analyzeAndOptimize = useCallback(async (prompt, context = null, brainstormContext = null) => {
    try {
      const data = await promptOptimizationApi.optimize({
        prompt,
        mode: selectedMode,
        context,
        brainstormContext,
      });
      return data.optimizedPrompt;
    } catch (error) {
      console.error('Error calling optimization API:', error);
      throw error;
    }
  }, [selectedMode]);

  const optimize = useCallback(async (promptToOptimize = inputPrompt, context = improvementContext, brainstormContext = null) => {
    if (!promptToOptimize.trim()) {
      toast.warning('Please enter a prompt');
      return null;
    }

    setIsProcessing(true);
    setOptimizedPrompt('');
    setDisplayedPrompt('');
    setQualityScore(null);
    setSkipAnimation(false);
    setDraftPrompt('');
    setIsDraftReady(false);
    setIsRefining(false);
    setDraftSpans(null);
    setRefinedSpans(null);

    try {
      // ⏱️ PERFORMANCE TIMER: Start optimization
      performance.mark('optimize-start');

      // Use two-stage optimization if enabled
      if (useTwoStage) {
        const result = await promptOptimizationApiV2.optimizeWithFallback({
          prompt: promptToOptimize,
          mode: selectedMode,
          context,
          brainstormContext,
          onDraft: (draft) => {
            // ⏱️ PERFORMANCE TIMER: Draft ready
            performance.mark('draft-ready');

            // Measure from optimize-start to draft-ready
            try {
              const entries = performance.getEntriesByName('optimize-start', 'mark');
              if (entries.length > 0) {
                performance.measure('optimize-to-draft', 'optimize-start', 'draft-ready');
              }
            } catch (e) {
              // Silently ignore if mark doesn't exist
            }

            // Draft is ready - show it immediately
            setDraftPrompt(draft);
            setOptimizedPrompt(draft); // Temporarily show draft
            setDisplayedPrompt(draft);
            setIsDraftReady(true);
            setIsRefining(true);
            setIsProcessing(false); // User can interact with draft

            // Calculate draft score
            const draftScore = promptOptimizationApiV2.calculateQualityScore(promptToOptimize, draft);
            setQualityScore(draftScore);

            toast.info('Draft ready! Refining in background...');
          },
          onSpans: (spans, source, meta) => {
            // ⏱️ PERFORMANCE: Spans received from parallel execution (~300ms)
            performance.mark(`spans-received-${source}`);

            // Store spans based on source (draft or refined)
            const spansData = {
              spans: spans || [],
              meta: meta || null,
              source,
              timestamp: Date.now(),
            };

            if (source === 'draft') {
              setDraftSpans(spansData);
              logger.debug('Draft spans received', {
                spanCount: spans?.length || 0,
                source
              });
            } else if (source === 'refined') {
              setRefinedSpans(spansData);
              logger.debug('Refined spans received', {
                spanCount: spans?.length || 0,
                source
              });
            }
          },
          onRefined: (refined, metadata) => {
            // ⏱️ PERFORMANCE TIMER: Refinement complete
            performance.mark('refinement-complete');

            // Only measure draft-to-refined if draft-ready mark exists
            try {
              const entries = performance.getEntriesByName('draft-ready', 'mark');
              if (entries.length > 0) {
                performance.measure('draft-to-refined', 'draft-ready', 'refinement-complete');
              }
            } catch (e) {
              // Silently ignore if mark doesn't exist
            }

            // Measure total time (this should always work as optimize-start is created first)
            try {
              performance.measure('optimize-to-refined-total', 'optimize-start', 'refinement-complete');
            } catch (e) {
              // Silently ignore if mark doesn't exist
            }

            // Refinement complete - upgrade to refined version
            const refinedScore = promptOptimizationApiV2.calculateQualityScore(promptToOptimize, refined);

            setOptimizedPrompt(refined);
            // IMPORTANT: Don't update displayedPrompt yet if we're waiting for refined spans
            // This prevents the draft highlights from being cleared before refined highlights are ready
            // The PromptCanvas will handle the transition when refined spans arrive
            if (!refinedSpans) {
              // No refined spans yet, update immediately
              setDisplayedPrompt(refined);
            }
            // If refinedSpans exist, PromptCanvas will update displayedPrompt when ready

            setQualityScore(refinedScore);
            setIsRefining(false);

            if (refinedScore >= 80) {
              toast.success(`Excellent prompt! Quality score: ${refinedScore}%`);
            } else if (refinedScore >= 60) {
              toast.success(`Refined! Quality score: ${refinedScore}%`);
            } else {
              toast.info(`Refined! Score: ${refinedScore}%`);
            }
          },
        });

        // Check if two-stage fell back to single-stage
        if (result.usedFallback) {
          toast.warning('Fast optimization unavailable. Using standard optimization (this may take longer).');
        }

        return {
          optimized: result.refined,
          score: promptOptimizationApiV2.calculateQualityScore(promptToOptimize, result.refined),
        };
      } else {
        // Fallback to legacy single-stage optimization
        const optimized = await analyzeAndOptimize(promptToOptimize, context, brainstormContext);
        const score = promptOptimizationApi.calculateQualityScore(promptToOptimize, optimized);

        setOptimizedPrompt(optimized);
        setQualityScore(score);

        // Show quality score toast
        if (score >= 80) {
          toast.success(`Excellent prompt! Quality score: ${score}%`);
        } else if (score >= 60) {
          toast.info(`Good prompt! Quality score: ${score}%`);
        } else {
          toast.warning(`Prompt could be improved. Score: ${score}%`);
        }

        return { optimized, score };
      }
    } catch (error) {
      console.error('Optimization failed:', error);
      toast.error('Failed to optimize. Make sure the server is running.');
      return null;
    } finally {
      setIsProcessing(false);
      setIsRefining(false);
    }
  }, [inputPrompt, improvementContext, analyzeAndOptimize, toast, useTwoStage, selectedMode]);

  const resetPrompt = useCallback(() => {
    setInputPrompt('');
    setOptimizedPrompt('');
    setDisplayedPrompt('');
    setQualityScore(null);
    setImprovementContext(null);
    setSkipAnimation(false);
    setDraftPrompt('');
    setIsDraftReady(false);
    setIsRefining(false);
    setDraftSpans(null);
    setRefinedSpans(null);
  }, []);

  return {
    // State
    inputPrompt,
    setInputPrompt,
    isProcessing,
    optimizedPrompt,
    setOptimizedPrompt,
    displayedPrompt,
    setDisplayedPrompt,
    qualityScore,
    skipAnimation,
    setSkipAnimation,
    improvementContext,
    setImprovementContext,

    // Two-stage state
    draftPrompt,
    isDraftReady,
    isRefining,

    // Span labeling state
    draftSpans,
    refinedSpans,

    // Actions
    optimize,
    resetPrompt
  };
};
