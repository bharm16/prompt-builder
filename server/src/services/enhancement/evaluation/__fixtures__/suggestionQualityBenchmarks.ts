import type { Suggestion } from "@services/enhancement/services/types";
import type { SuggestionTestCase } from "../SuggestionQualityEvaluator";

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
    name: "subject-face-detail",
    testCase: {
      id: "toddler-face-detail",
      prompt: toddlerCarPrompt,
      span: {
        text: "toddler's tiny rosy-cheeked face",
        category: "subject.appearance",
      },
      contextBefore: "Medium close-up, eye-level shot, slowly zooming in on a ",
      contextAfter: " and plump hands gripping a dark grey steering wheel.",
      spanAnchors: '- subject: "plump hands"\n- action: "gripping"',
      nearbySpanHints:
        '- camera: "slowly zooming in"\n- subject: "plump hands"',
      expectedQualities: {
        contextualFit: { min: 5 },
        categoryAlignment: { min: 5 },
        diversity: { min: 5 },
        videoSpecificity: { min: 5 },
        sceneCoherence: { min: 5 },
      },
    },
    suggestions: [
      {
        text: "wide-eyed face with dimpled cheeks",
        category: "subject.appearance",
      },
      {
        text: "bright eyes and flushed cheeks",
        category: "subject.appearance",
      },
      { text: "freckled nose and parted lips", category: "subject.appearance" },
    ],
    invalidPatterns: ["hands", "feet", "hair", "window", "toy"],
  },
  {
    name: "subject-hand-detail",
    testCase: {
      id: "toddler-hand-detail",
      prompt: toddlerCarPrompt,
      span: { text: "plump hands", category: "subject.appearance" },
      contextBefore: "a toddler's tiny rosy-cheeked face and ",
      contextAfter: " gripping a dark grey steering wheel.",
      spanAnchors:
        '- action: "gripping"\n- subject: "dark grey steering wheel"',
      nearbySpanHints:
        '- subject: "toddler\'s tiny rosy-cheeked face"\n- action: "gripping"',
      expectedQualities: {
        contextualFit: { min: 5 },
        categoryAlignment: { min: 5 },
        diversity: { min: 5 },
        videoSpecificity: { min: 5 },
        sceneCoherence: { min: 5 },
      },
    },
    suggestions: [
      {
        text: "soft little hands with bitten nails",
        category: "subject.appearance",
      },
      {
        text: "rounded palms with tiny birthmark",
        category: "subject.appearance",
      },
      {
        text: "small hands with sun-kissed knuckles",
        category: "subject.appearance",
      },
    ],
    invalidPatterns: ["socks", "toy", "feet", "hair", "face"],
  },
  {
    name: "action-hand-interaction",
    testCase: {
      id: "toddler-hand-action",
      prompt: toddlerCarPrompt,
      span: { text: "gripping", category: "action.movement" },
      contextBefore: "a toddler's tiny rosy-cheeked face and plump hands ",
      contextAfter: " a dark grey steering wheel.",
      spanAnchors:
        '- subject: "plump hands"\n- subject: "dark grey steering wheel"',
      nearbySpanHints:
        '- subject: "plump hands"\n- subject: "dark grey steering wheel"',
      expectedQualities: {
        contextualFit: { min: 5 },
        categoryAlignment: { min: 5 },
        diversity: { min: 5 },
        videoSpecificity: { min: 5 },
        sceneCoherence: { min: 5 },
      },
    },
    suggestions: [
      { text: "pressing with tiny fingers", category: "action.movement" },
      { text: "steadying with both palms", category: "action.movement" },
      { text: "curling small fingers", category: "action.movement" },
    ],
    invalidPatterns: ["wheel", "dashboard", "leaning", "smiling"],
  },
  {
    name: "camera-angle",
    testCase: {
      id: "toddler-camera-angle",
      prompt: toddlerCarPrompt,
      span: { text: "eye level", category: "camera.angle" },
      contextBefore: "Cinematic ",
      contextAfter: " drawing the viewer medium close.",
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
      { text: "low-angle view", category: "camera.angle" },
      { text: "high-angle perspective", category: "camera.angle" },
      { text: "overhead viewpoint", category: "camera.angle" },
    ],
    invalidPatterns: ["dolly", "zoom", "lens", "35mm", "backlight"],
  },
  {
    name: "lighting-adverb-slot",
    testCase: {
      id: "toddler-lighting-adverb",
      prompt: toddlerCarPrompt,
      span: { text: "intensely", category: "lighting.quality" },
      contextBefore: "Warm, golden hour sunlight streams ",
      contextAfter: " through the car windows.",
      spanAnchors: '- lighting: "Warm"\n- environment: "car windows"',
      nearbySpanHints:
        '- lighting: "golden hour sunlight"\n- environment: "car windows"',
      expectedQualities: {
        contextualFit: { min: 5 },
        categoryAlignment: { min: 5 },
        diversity: { min: 5 },
        videoSpecificity: { min: 5 },
        sceneCoherence: { min: 5 },
      },
    },
    suggestions: [
      { text: "softly", category: "lighting.quality" },
      { text: "warmly", category: "lighting.quality" },
      { text: "brightly", category: "lighting.quality" },
    ],
    invalidPatterns: ["glow", "window", "backlight", "left-lit"],
  },
  {
    name: "lighting-time-of-day",
    testCase: {
      id: "toddler-time-of-day",
      prompt: toddlerCarPrompt,
      span: { text: "golden hour sunlight", category: "lighting.timeOfDay" },
      contextBefore: "Warm, ",
      contextAfter: " streams intensely through the car windows.",
      spanAnchors:
        '- environment: "car windows"\n- style: "Kodak Portra 400 film"',
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
      { text: "misty blue hour", category: "lighting.timeOfDay" },
      { text: "late afternoon haze", category: "lighting.timeOfDay" },
      { text: "quiet dawn light", category: "lighting.timeOfDay" },
    ],
    invalidPatterns: ["backlight", "window", "flare", "left-lit", "rim light"],
  },
  {
    name: "car-windows-context",
    testCase: {
      id: "toddler-car-windows",
      prompt: toddlerCarPrompt,
      span: { text: "car windows", category: "environment.context" },
      contextBefore:
        "Warm, golden hour sunlight streams intensely through the ",
      contextAfter: ", creating high dynamic range lighting.",
      spanAnchors:
        '- lighting: "golden hour sunlight"\n- environment: "dashboard"',
      nearbySpanHints: '- lighting: "intensely"\n- environment: "dashboard"',
      expectedQualities: {
        contextualFit: { min: 5 },
        categoryAlignment: { min: 5 },
        diversity: { min: 5 },
        videoSpecificity: { min: 5 },
        sceneCoherence: { min: 5 },
      },
    },
    suggestions: [
      { text: "rain-speckled window glass", category: "environment.context" },
      { text: "fogged windshield panes", category: "environment.context" },
      { text: "dust-softened side glass", category: "environment.context" },
    ],
    invalidPatterns: ["meadow", "lake", "forest", "cityscape", "beach"],
  },
  {
    name: "shadow-quality",
    testCase: {
      id: "toddler-shadow-quality",
      prompt: toddlerCarPrompt,
      span: { text: "soft, elongated shadows", category: "lighting.quality" },
      contextBefore: "and casting ",
      contextAfter: " across the dashboard.",
      spanAnchors:
        '- environment: "dashboard"\n- lighting: "dust particles in the air"',
      nearbySpanHints:
        '- environment: "dashboard"\n- lighting: "high dynamic range lighting"',
      expectedQualities: {
        contextualFit: { min: 5 },
        categoryAlignment: { min: 5 },
        diversity: { min: 5 },
        videoSpecificity: { min: 5 },
        sceneCoherence: { min: 5 },
      },
    },
    suggestions: [
      { text: "soft cabin shadows", category: "lighting.quality" },
      { text: "long window shadows", category: "lighting.quality" },
      { text: "diffuse dashboard shadows", category: "lighting.quality" },
    ],
    invalidPatterns: ["glow", "diffusion", "backlight", "flare"],
  },
  {
    name: "dashboard-context",
    testCase: {
      id: "toddler-dashboard",
      prompt: toddlerCarPrompt,
      span: { text: "dashboard", category: "environment.context" },
      contextBefore: "casting soft, elongated shadows across the ",
      contextAfter: ". The shallow depth of field",
      spanAnchors:
        '- lighting: "soft, elongated shadows"\n- subject: "dark grey steering wheel"',
      nearbySpanHints:
        '- environment: "car windows"\n- lighting: "dust particles in the air"',
      expectedQualities: {
        contextualFit: { min: 5 },
        categoryAlignment: { min: 5 },
        diversity: { min: 5 },
        videoSpecificity: { min: 5 },
        sceneCoherence: { min: 5 },
      },
    },
    suggestions: [
      { text: "faded leather dashboard", category: "environment.context" },
      { text: "dusty plastic dashboard", category: "environment.context" },
      { text: "matte vinyl dashboard", category: "environment.context" },
    ],
    invalidPatterns: ["meadow", "lake", "street", "forest", "beach"],
  },
  {
    name: "environment-context",
    testCase: {
      id: "toddler-environment-context",
      prompt: toddlerCarPrompt,
      span: { text: "car's front window", category: "environment.context" },
      contextBefore: "with the soft blur of a park view visible through the ",
      contextAfter: ", creating a sense of intimate observation.",
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
      {
        text: "rain-streaked windshield glass",
        category: "environment.context",
      },
      { text: "fogged passenger-side window", category: "environment.context" },
      { text: "dust-softened side glass", category: "environment.context" },
    ],
    invalidPatterns: ["lake", "beach", "forest", "cityscape", "street"],
  },
  {
    name: "camera-lens",
    testCase: {
      id: "toddler-camera-lens",
      prompt: toddlerCarPrompt,
      span: { text: "wide aperture", category: "camera.lens" },
      contextBefore: "The shallow depth of field, achieved with a ",
      contextAfter: ", renders the background in a creamy bokeh.",
      spanAnchors:
        '- camera: "shallow depth of field"\n- style: "creamy bokeh"',
      nearbySpanHints: '- style: "tender"\n- style: "Kodak Portra 400 film"',
      expectedQualities: {
        contextualFit: { min: 5 },
        categoryAlignment: { min: 5 },
        diversity: { min: 5 },
        videoSpecificity: { min: 5 },
        sceneCoherence: { min: 5 },
      },
    },
    suggestions: [
      { text: "low f-number", category: "camera.lens" },
      { text: "open iris setting", category: "camera.lens" },
      { text: "fast prime lens", category: "camera.lens" },
    ],
    invalidPatterns: ["blur", "bokeh", "dolly", "tracking", "wide shot"],
  },
  {
    name: "style-aesthetic",
    testCase: {
      id: "toddler-style-aesthetic",
      prompt: toddlerCarPrompt,
      span: { text: "creamy bokeh", category: "style.aesthetic" },
      contextBefore: "renders the background in a ",
      contextAfter: ". A tender, naturalist portraiture scene",
      spanAnchors:
        '- camera: "shallow depth of field"\n- style: "Kodak Portra 400 film"',
      nearbySpanHints:
        '- style: "tender"\n- style: "naturalist portraiture scene"',
      expectedQualities: {
        contextualFit: { min: 5 },
        categoryAlignment: { min: 5 },
        diversity: { min: 5 },
        videoSpecificity: { min: 5 },
        sceneCoherence: { min: 5 },
      },
    },
    suggestions: [
      { text: "painterly pastel", category: "style.aesthetic" },
      { text: "grainy monochrome", category: "style.aesthetic" },
      { text: "sepia-toned watercolor", category: "style.aesthetic" },
    ],
    invalidPatterns: [
      "handheld",
      "tracking",
      "backlight",
      "left-lit",
      "window glare",
    ],
  },
  {
    name: "park-view-location",
    testCase: {
      id: "toddler-park-view",
      prompt: toddlerCarPrompt,
      span: { text: "park view", category: "environment.location" },
      contextBefore: "with the soft blur of a ",
      contextAfter: " visible through the car's front window.",
      spanAnchors: '- environment: "car\'s front window"\n- style: "soft blur"',
      nearbySpanHints:
        '- style: "Kodak Portra 400 film"\n- environment: "car\'s front window"',
      expectedQualities: {
        contextualFit: { min: 5 },
        categoryAlignment: { min: 5 },
        diversity: { min: 5 },
        videoSpecificity: { min: 5 },
        sceneCoherence: { min: 5 },
      },
    },
    suggestions: [
      { text: "sunlit autumn meadow", category: "environment.location" },
      { text: "tree-lined park trail", category: "environment.location" },
      { text: "quiet lakeside turnout", category: "environment.location" },
    ],
    invalidPatterns: [
      "dashboard",
      "window glass",
      "rearview mirror",
      "console",
    ],
  },
];

export const representativeSuggestionBenchmarks: SuggestionBenchmarkFixture[] =
  [
    {
      name: "camera-focus",
      testCase: {
        id: "camera-focus-benchmark",
        prompt:
          "A boxer stands under arena lights with the crowd blurred behind him.",
        span: { text: "shallow focus", category: "camera.focus" },
        contextBefore: "The portrait holds ",
        contextAfter: " on the boxer while the crowd falls away.",
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
        { text: "creamy background bokeh", category: "camera.focus" },
        { text: "tight selective focus", category: "camera.focus" },
        { text: "soft rear-plane blur", category: "camera.focus" },
      ],
      invalidPatterns: ["dolly", "50mm", "wide shot"],
    },
    {
      name: "subject-appearance",
      testCase: {
        id: "subject-benchmark",
        prompt:
          "A child laughs in the front seat while sunbeams flicker across the dashboard.",
        span: { text: "playful child", category: "subject.appearance" },
        contextBefore: "A ",
        contextAfter:
          " laughs in the front seat while sunbeams flicker across the dashboard.",
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
        {
          text: "bright-eyed toddler with freckles",
          category: "subject.appearance",
        },
        {
          text: "round-cheeked child with messy curls",
          category: "subject.appearance",
        },
        {
          text: "sleepy-eyed kid with sunlit skin",
          category: "subject.appearance",
        },
      ],
      invalidPatterns: ["puppy", "robot", "alien", "clown"],
    },
    {
      name: "environment-location",
      testCase: {
        id: "environment-location-benchmark",
        prompt: "A couple stands by a roadside diner at sunset.",
        span: { text: "roadside diner", category: "environment.location" },
        contextBefore: "A couple stands by a ",
        contextAfter: " at sunset.",
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
        { text: "foggy boardwalk at dawn", category: "environment.location" },
        {
          text: "sunlit desert turnout at noon",
          category: "environment.location",
        },
        { text: "rainy city alley at night", category: "environment.location" },
      ],
      invalidPatterns: ["dashboard", "window glass", "rearview mirror"],
    },
  ];
