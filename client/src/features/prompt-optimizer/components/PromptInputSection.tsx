import React from 'react';
import { PromptInput } from '../PromptInput';
import { usePromptState } from '../context/PromptStateContext';
import type { PromptInputSectionProps } from '../types';

/**
 * PromptInputSection - Input/Hero Section
 *
 * Handles the prompt input and loading skeleton
 * Extracted from PromptOptimizerContainer for better separation of concerns
 */
export const PromptInputSection = ({ aiNames, onOptimize, onShowBrainstorm }: PromptInputSectionProps): React.ReactElement => {
  const {
    selectedModel,
    setSelectedModel,
    generationParams,
    setGenerationParams,
    currentAIIndex,
    promptOptimizer,
  } = usePromptState();

  return (
    <PromptInput
      inputPrompt={promptOptimizer.inputPrompt}
      onInputChange={promptOptimizer.setInputPrompt}
      selectedModel={selectedModel}
      onModelChange={setSelectedModel}
      onOptimize={onOptimize}
      generationParams={generationParams}
      onGenerationParamsChange={setGenerationParams}
      {...(onShowBrainstorm ? { onShowBrainstorm } : {})}
      isProcessing={promptOptimizer.isProcessing}
      {...(aiNames ? { aiNames } : {})}
      currentAIIndex={currentAIIndex}
    />
  );
};
