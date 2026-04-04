import type { Suggestion } from "@services/enhancement/services/types";
import type { SuggestionTestCase } from "../SuggestionQualityEvaluator";

export interface HardCaseFixture {
  name: string;
  testCase: SuggestionTestCase;
  suggestions: Suggestion[];
}

export const hardCaseBenchmarks: HardCaseFixture[] = [
  {
    name: "rigid-slot-category-drift",
    testCase: {
      id: "rigid-slot-category-drift",
      prompt:
        "Warm golden hour sunlight pours through dusty windows inside the car.",
      span: { text: "golden hour sunlight", category: "lighting.timeOfDay" },
      contextBefore: "Warm ",
      contextAfter: " pours through dusty windows inside the car.",
      spanAnchors: '- environment: "dusty windows"\n- lighting: "Warm"',
      nearbySpanHints: '- environment: "car"',
      expectedQualities: {
        contextualFit: { min: 4 },
        categoryAlignment: { min: 4 },
        sceneCoherence: { min: 4 },
      },
    },
    suggestions: [
      { text: "blue hour", category: "lighting.timeOfDay" },
      { text: "late afternoon", category: "lighting.timeOfDay" },
      { text: "soft window backlight", category: "lighting.timeOfDay" },
    ],
  },
  {
    name: "action-object-overlap",
    testCase: {
      id: "action-object-overlap",
      prompt:
        "A toddler's small hands grip the steering wheel while sunlight flickers across the dashboard.",
      span: { text: "grip", category: "action.movement" },
      contextBefore: "A toddler's small hands ",
      contextAfter:
        " the steering wheel while sunlight flickers across the dashboard.",
      spanAnchors: '- subject: "small hands"\n- subject: "steering wheel"',
      nearbySpanHints: '- environment: "dashboard"',
      expectedQualities: {
        contextualFit: { min: 4 },
        sceneCoherence: { min: 4 },
      },
    },
    suggestions: [
      { text: "curling small fingers", category: "action.movement" },
      { text: "holding the steering wheel", category: "action.movement" },
      { text: "steadying with both palms", category: "action.movement" },
    ],
  },
  {
    name: "interior-exterior-bleed",
    testCase: {
      id: "interior-exterior-bleed",
      prompt:
        "Soft shadows drift across the dashboard while the park view blurs outside the front window.",
      span: { text: "dashboard", category: "environment.context" },
      contextBefore: "Soft shadows drift across the ",
      contextAfter: " while the park view blurs outside the front window.",
      spanAnchors: '- environment: "front window"\n- environment: "park view"',
      nearbySpanHints: '- lighting: "Soft shadows"',
      expectedQualities: {
        contextualFit: { min: 4 },
        categoryAlignment: { min: 4 },
        sceneCoherence: { min: 4 },
      },
    },
    suggestions: [
      { text: "matte vinyl dashboard", category: "environment.context" },
      { text: "sunlit meadow path", category: "environment.context" },
      { text: "dusty center console", category: "environment.context" },
    ],
  },
];
