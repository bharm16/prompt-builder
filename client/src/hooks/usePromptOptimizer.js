import { useState, useCallback } from 'react';
import { useToast } from '../components/Toast';
import { promptOptimizationApi } from '../services';
import { promptOptimizationApiV2 } from '../services/PromptOptimizationApiV2';

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

    try {
      // Use two-stage optimization if enabled
      if (useTwoStage) {
        const result = await promptOptimizationApiV2.optimizeWithFallback({
          prompt: promptToOptimize,
          mode: selectedMode,
          context,
          brainstormContext,
          onDraft: (draft) => {
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
          onRefined: (refined, metadata) => {
            // Refinement complete - upgrade to refined version
            const refinedScore = promptOptimizationApiV2.calculateQualityScore(promptToOptimize, refined);

            setOptimizedPrompt(refined);
            setDisplayedPrompt(refined);
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

    // Actions
    optimize,
    resetPrompt
  };
};
