import { useState, useCallback } from 'react';
import { useToast } from '../components/Toast';
import { promptOptimizationApi } from '../services';

export const usePromptOptimizer = (selectedMode) => {
  const [inputPrompt, setInputPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [optimizedPrompt, setOptimizedPrompt] = useState('');
  const [displayedPrompt, setDisplayedPrompt] = useState('');
  const [qualityScore, setQualityScore] = useState(null);
  const [skipAnimation, setSkipAnimation] = useState(false);
  const [improvementContext, setImprovementContext] = useState(null);

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

    try {
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
    } catch (error) {
      console.error('Optimization failed:', error);
      toast.error('Failed to optimize. Make sure the server is running.');
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [inputPrompt, improvementContext, analyzeAndOptimize, toast]);

  const resetPrompt = useCallback(() => {
    setInputPrompt('');
    setOptimizedPrompt('');
    setDisplayedPrompt('');
    setQualityScore(null);
    setImprovementContext(null);
    setSkipAnimation(false);
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

    // Actions
    optimize,
    resetPrompt
  };
};
