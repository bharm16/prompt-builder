import { describe, expect, it, vi } from 'vitest';

const { schemasMock } = vi.hoisted(() => ({
  schemasMock: {
    promptSchema: { name: 'prompt' },
    compileSchema: { name: 'compile' },
    suggestionSchema: { name: 'suggestion' },
    customSuggestionSchema: { name: 'customSuggestion' },
    sceneChangeSchema: { name: 'sceneChange' },
    coherenceCheckSchema: { name: 'coherenceCheck' },
    creativeSuggestionSchema: { name: 'creativeSuggestion' },
    videoValidationSchema: { name: 'videoValidation' },
    completeSceneSchema: { name: 'completeScene' },
    variationsSchema: { name: 'variations' },
    parseConceptSchema: { name: 'parseConcept' },
    saveTemplateSchema: { name: 'saveTemplate' },
    templateRecommendationsSchema: { name: 'templateRecommendations' },
    recordUserChoiceSchema: { name: 'recordUserChoice' },
    alternativePhrasingsSchema: { name: 'alternativePhrasings' },
    compatibilityOutputSchema: { name: 'compatibilityOutput' },
    completeSceneOutputSchema: { name: 'completeSceneOutput' },
    variationsOutputSchema: { name: 'variationsOutput' },
    parseConceptOutputSchema: { name: 'parseConceptOutput' },
    refinementsOutputSchema: { name: 'refinementsOutput' },
    conflictsOutputSchema: { name: 'conflictsOutput' },
    technicalParamsOutputSchema: { name: 'technicalParamsOutput' },
    validatePromptOutputSchema: { name: 'validatePromptOutput' },
    smartDefaultsOutputSchema: { name: 'smartDefaultsOutput' },
    alternativePhrasingsOutputSchema: { name: 'alternativePhrasingsOutput' },
  },
}));

vi.mock('@config/schemas/index', () => schemasMock);

import * as validationExports from '../validation';

describe('validation re-exports', () => {
  it('re-exports schema definitions from config/schemas/index', () => {
    expect(validationExports.promptSchema).toBe(schemasMock.promptSchema);
    expect(validationExports.suggestionSchema).toBe(schemasMock.suggestionSchema);
    expect(validationExports.videoValidationSchema).toBe(schemasMock.videoValidationSchema);
    expect(validationExports.compatibilityOutputSchema).toBe(schemasMock.compatibilityOutputSchema);
    expect(validationExports.alternativePhrasingsOutputSchema).toBe(
      schemasMock.alternativePhrasingsOutputSchema
    );
  });
});
