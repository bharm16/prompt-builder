import { useState, useCallback } from 'react';
import { useToast } from '../components/Toast';

export const usePromptOptimizer = (selectedMode) => {
  const [inputPrompt, setInputPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [optimizedPrompt, setOptimizedPrompt] = useState('');
  const [displayedPrompt, setDisplayedPrompt] = useState('');
  const [qualityScore, setQualityScore] = useState(null);
  const [skipAnimation, setSkipAnimation] = useState(false);
  const [improvementContext, setImprovementContext] = useState(null);

  const toast = useToast();

  const calculateQualityScore = useCallback((input, output) => {
    let score = 0;
    const inputWords = input.split(/\s+/).length;
    const outputWords = output.split(/\s+/).length;

    if (outputWords > inputWords * 2) score += 25;
    else if (outputWords > inputWords) score += 15;

    const sections = (output.match(/\*\*/g) || []).length / 2;
    score += Math.min(sections * 10, 30);

    if (output.includes('Goal')) score += 15;
    if (output.includes('Return Format') || output.includes('Research')) score += 15;
    if (output.includes('Context') || output.includes('Learning')) score += 15;

    return Math.min(score, 100);
  }, []);

  const analyzeAndOptimize = useCallback(async (prompt, context = null, brainstormContext = null) => {
    try {
      const response = await fetch('/api/optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'dev-key-12345',
        },
        body: JSON.stringify({
          prompt: prompt,
          mode: selectedMode,
          context: context,
          brainstormContext: brainstormContext, // Pass brainstorm context to backend
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'API request failed');
      }

      const data = await response.json();
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
      const score = calculateQualityScore(promptToOptimize, optimized);

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
  }, [inputPrompt, improvementContext, analyzeAndOptimize, calculateQualityScore, toast]);

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
    calculateQualityScore,
    resetPrompt
  };
};
