import type { Suggestion } from '@services/enhancement/services/types';
import type { SuggestionTestCase } from '../SuggestionQualityEvaluator';

export interface SuggestionBenchmarkFixture {
  name: string;
  testCase: SuggestionTestCase;
  suggestions: Suggestion[];
  invalidPatterns?: string[];
}

export const toddlerCarPrompt =
  "Cinematic eye level drawing the viewer medium close. Medium close-up, eye-level shot, slowly zooming in on a toddler's tiny rosy-cheeked face and plump hands gripping a dark grey steering wheel. Warm, golden hour sunlight streams intensely through the car windows, creating high dynamic range lighting, scattering through dust particles in the air, and casting soft, elongated shadows across the dashboard. The shallow depth of field, achieved with a wide aperture, renders the background in a creamy bokeh. A tender, naturalist portraiture scene, evoking the nostalgic warmth and rich tones of Kodak Portra 400 film, with the soft blur of a park view visible through the car's front window, creating a sense of intimate observation.";

export const toddlerCarBlockingBenchmarks: SuggestionBenchmarkFixture[] = [
  {
    name: 'camera-angle',
    testCase: {
      id: 'toddler-camera-angle',
      prompt: toddlerCarPrompt,
      span: { text: 'eye level', category: 'camera.angle' },
      contextBefore: 'Cinematic ',
      contextAfter: ' drawing the viewer medium close.',
      spanAnchors: '- shot: "medium close"\n- subject: "toddler\'s face"',
      nearbySpanHints: '- camera: "eye-level shot"\n- shot: "Medium close-up"',
      expectedQualities: {
        contextualFit: { min: 5 },
        categoryAlignment: { min: 5 },
        diversity: { min: 5 },
        videoSpecificity: { min: 5 },
        sceneCoherence: { min: 5 },
      },
    },
    suggestions: [
      { text: 'low-angle view', category: 'camera.angle' },
      { text: 'high-angle perspective', category: 'camera.angle' },
      { text: 'overhead viewpoint', category: 'camera.angle' },
    ],
    invalidPatterns: ['dolly', 'zoom', 'lens', '35mm', 'backlight'],
  },
  {
    name: 'lighting-time-of-day',
    testCase: {
      id: 'toddler-time-of-day',
      prompt: toddlerCarPrompt,
      span: { text: 'golden hour sunlight', category: 'lighting.timeOfDay' },
      contextBefore: 'Warm, ',
      contextAfter: ' streams intensely through the car windows.',
      spanAnchors: '- environment: "car windows"\n- style: "Kodak Portra 400 film"',
      nearbySpanHints: '- lighting: "Warm"\n- camera: "wide aperture"',
      expectedQualities: {
        contextualFit: { min: 5 },
        categoryAlignment: { min: 5 },
        diversity: { min: 5 },
        videoSpecificity: { min: 5 },
        sceneCoherence: { min: 5 },
      },
    },
    suggestions: [
      { text: 'misty blue hour', category: 'lighting.timeOfDay' },
      { text: 'late afternoon haze', category: 'lighting.timeOfDay' },
      { text: 'quiet dawn light', category: 'lighting.timeOfDay' },
    ],
    invalidPatterns: ['backlight', 'window', 'flare', 'left-lit', 'rim light'],
  },
  {
    name: 'environment-context',
    testCase: {
      id: 'toddler-environment-context',
      prompt: toddlerCarPrompt,
      span: { text: "car's front window", category: 'environment.context' },
      contextBefore: 'with the soft blur of a park view visible through the ',
      contextAfter: ', creating a sense of intimate observation.',
      spanAnchors: '- environment: "park view"\n- subject: "toddler\'s face"',
      nearbySpanHints: '- style: "soft blur"\n- environment: "park view"',
      expectedQualities: {
        contextualFit: { min: 5 },
        categoryAlignment: { min: 5 },
        diversity: { min: 5 },
        videoSpecificity: { min: 5 },
        sceneCoherence: { min: 5 },
      },
    },
    suggestions: [
      { text: 'rain-streaked windshield glass', category: 'environment.context' },
      { text: 'fogged passenger-side window', category: 'environment.context' },
      { text: 'dust-softened side glass', category: 'environment.context' },
    ],
    invalidPatterns: ['lake', 'beach', 'forest', 'cityscape', 'street'],
  },
  {
    name: 'style-aesthetic',
    testCase: {
      id: 'toddler-style-aesthetic',
      prompt: toddlerCarPrompt,
      span: { text: 'creamy bokeh', category: 'style.aesthetic' },
      contextBefore: 'renders the background in a ',
      contextAfter: '. A tender, naturalist portraiture scene',
      spanAnchors: '- camera: "shallow depth of field"\n- style: "Kodak Portra 400 film"',
      nearbySpanHints: '- style: "tender"\n- style: "naturalist portraiture scene"',
      expectedQualities: {
        contextualFit: { min: 5 },
        categoryAlignment: { min: 5 },
        diversity: { min: 5 },
        videoSpecificity: { min: 5 },
        sceneCoherence: { min: 5 },
      },
    },
    suggestions: [
      { text: 'gritty film grain overlay', category: 'style.aesthetic' },
      { text: 'pastel watercolor diffusion', category: 'style.aesthetic' },
      { text: 'crisp monochrome filter', category: 'style.aesthetic' },
    ],
    invalidPatterns: ['handheld', 'tracking', 'backlight', 'left-lit', 'window glare'],
  },
];

export const representativeSuggestionBenchmarks: SuggestionBenchmarkFixture[] = [
  {
    name: 'camera-focus',
    testCase: {
      id: 'camera-focus-benchmark',
      prompt: 'A boxer stands under arena lights with the crowd blurred behind him.',
      span: { text: 'shallow focus', category: 'camera.focus' },
      contextBefore: 'The portrait holds ',
      contextAfter: ' on the boxer while the crowd falls away.',
      spanAnchors: '- subject: "boxer"\n- lighting: "arena lights"',
      nearbySpanHints: '- shot: "portrait"\n- environment: "crowd"',
      expectedQualities: {
        contextualFit: { min: 5 },
        categoryAlignment: { min: 5 },
        diversity: { min: 5 },
        videoSpecificity: { min: 5 },
        sceneCoherence: { min: 5 },
      },
    },
    suggestions: [
      { text: 'creamy background bokeh', category: 'camera.focus' },
      { text: 'tight selective focus', category: 'camera.focus' },
      { text: 'soft rear-plane blur', category: 'camera.focus' },
    ],
    invalidPatterns: ['dolly', '50mm', 'wide shot'],
  },
  {
    name: 'subject-appearance',
    testCase: {
      id: 'subject-benchmark',
      prompt: 'A child laughs in the front seat while sunbeams flicker across the dashboard.',
      span: { text: 'playful child', category: 'subject.appearance' },
      contextBefore: 'A ',
      contextAfter: ' laughs in the front seat while sunbeams flicker across the dashboard.',
      spanAnchors: '- environment: "front seat"\n- lighting: "sunbeams"',
      nearbySpanHints: '- environment: "dashboard"',
      expectedQualities: {
        contextualFit: { min: 5 },
        categoryAlignment: { min: 5 },
        diversity: { min: 5 },
        videoSpecificity: { min: 5 },
        sceneCoherence: { min: 5 },
      },
    },
    suggestions: [
      { text: 'bright-eyed toddler with freckles', category: 'subject.appearance' },
      { text: 'round-cheeked child with messy curls', category: 'subject.appearance' },
      { text: 'sleepy-eyed kid with sunlit skin', category: 'subject.appearance' },
    ],
    invalidPatterns: ['puppy', 'robot', 'alien', 'clown'],
  },
  {
    name: 'environment-location',
    testCase: {
      id: 'environment-location-benchmark',
      prompt: 'A couple stands by a roadside diner at sunset.',
      span: { text: 'roadside diner', category: 'environment.location' },
      contextBefore: 'A couple stands by a ',
      contextAfter: ' at sunset.',
      spanAnchors: '- subject: "couple"\n- lighting: "sunset"',
      nearbySpanHints: '- style: "cinematic"',
      expectedQualities: {
        contextualFit: { min: 5 },
        categoryAlignment: { min: 5 },
        diversity: { min: 5 },
        videoSpecificity: { min: 5 },
        sceneCoherence: { min: 5 },
      },
    },
    suggestions: [
      { text: 'foggy boardwalk at dawn', category: 'environment.location' },
      { text: 'sunlit desert turnout at noon', category: 'environment.location' },
      { text: 'rainy city alley at night', category: 'environment.location' },
    ],
    invalidPatterns: ['dashboard', 'window glass', 'rearview mirror'],
  },
];
