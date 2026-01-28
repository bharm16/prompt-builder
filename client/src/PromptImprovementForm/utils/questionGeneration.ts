import type { FormData, Question } from '../types';

type PromptType =
  | 'compare'
  | 'explain'
  | 'write'
  | 'analyze'
  | 'plan'
  | 'debug'
  | 'optimize'
  | 'summarize'
  | 'general';

const ASPECT_TITLES: Record<PromptType, string> = {
  compare: 'What comparison criteria matter most?',
  explain: 'What should the explanation focus on?',
  write: 'What elements should the content include?',
  analyze: 'What should the analysis prioritize?',
  plan: 'What should the plan emphasize?',
  debug: 'What context helps solve this?',
  optimize: 'What should be optimized for?',
  summarize: 'What details should be highlighted?',
  general: 'What specific aspects matter most?',
};

const ASPECT_DESCRIPTIONS: Record<PromptType, (topic: string) => string> = {
  compare: (topic) => `When comparing options for "${topic}", which criteria are most important to you?`,
  explain: (topic) => `When explaining "${topic}", what aspects should be covered in detail?`,
  write: (topic) => `When writing about "${topic}", what key elements must be included?`,
  analyze: (topic) => `When analyzing "${topic}", what factors should be examined closely?`,
  plan: (topic) => `When planning "${topic}", what considerations are most critical?`,
  debug: (topic) => `To help debug "${topic}", what additional context would be useful?`,
  optimize: (topic) => `When optimizing "${topic}", what are your priority goals?`,
  summarize: (topic) => `When summarizing "${topic}", what information is most valuable?`,
  general: (topic) => `For "${topic}", what particular aspects should be emphasized?`,
};

const BACKGROUND_TITLES: Record<PromptType, string> = {
  compare: 'How familiar are you with these options?',
  explain: "What's your current understanding?",
  write: 'Who is the target audience?',
  analyze: "What's your analysis skill level?",
  plan: "What's your planning experience?",
  debug: "What's your technical background?",
  optimize: "What's your optimization experience?",
  summarize: 'How deep should the summary be?',
  general: "What's your background level?",
};

const BACKGROUND_DESCRIPTIONS: Record<PromptType, string> = {
  compare:
    'Understanding your familiarity helps provide the right level of detail in the comparison.',
  explain:
    'Knowing your current knowledge helps pitch the explanation at the right level.',
  write:
    'Understanding the audience helps set the appropriate tone and complexity.',
  analyze:
    'Your background helps determine the depth and rigor of the analysis.',
  plan: 'Your experience level helps shape the detail and guidance in the plan.',
  debug:
    'Your technical level helps provide appropriate troubleshooting steps.',
  optimize:
    'Your experience helps determine which optimization strategies to suggest.',
  summarize:
    'This helps determine how technical or simplified the summary should be.',
  general:
    'Your knowledge level helps tailor the complexity and depth of the response.',
};

const USE_TITLES: Record<PromptType, string> = {
  compare: 'What decision are you making?',
  explain: 'Why do you need to understand this?',
  write: 'Where will this be used?',
  analyze: 'What will you do with the analysis?',
  plan: "What's the plan's purpose?",
  debug: "What's your goal with the fix?",
  optimize: "What's driving the optimization?",
  summarize: 'How will you use the summary?',
  general: "What's your intended use?",
};

const USE_DESCRIPTIONS: Record<PromptType, string> = {
  compare:
    'Understanding your decision context helps provide relevant comparison criteria.',
  explain:
    'Knowing your purpose helps structure the explanation appropriately.',
  write:
    'The context helps determine format, style, and content priorities.',
  analyze: 'The end goal helps focus the analysis on actionable insights.',
  plan: 'Understanding the purpose helps create a practical, focused plan.',
  debug: 'Your goal helps prioritize the most effective solutions.',
  optimize: 'The driver helps focus on the right optimization targets.',
  summarize: 'The use case helps determine what information to prioritize.',
  general: "How you'll use this helps determine the format and focus.",
};

function detectPromptType(prompt: string): PromptType {
  if (prompt.includes('compar')) return 'compare';
  if (
    prompt.includes('explain') ||
    prompt.includes('how does') ||
    prompt.includes('what is')
  ) {
    return 'explain';
  }
  if (
    prompt.includes('write') ||
    prompt.includes('draft') ||
    prompt.includes('create')
  ) {
    return 'write';
  }
  if (prompt.includes('analyz') || prompt.includes('evaluat')) {
    return 'analyze';
  }
  if (prompt.includes('plan') || prompt.includes('strateg')) {
    return 'plan';
  }
  if (
    prompt.includes('debug') ||
    prompt.includes('fix') ||
    prompt.includes('troubleshoot')
  ) {
    return 'debug';
  }
  if (prompt.includes('optimize') || prompt.includes('improve')) {
    return 'optimize';
  }
  if (prompt.includes('summariz') || prompt.includes('review')) {
    return 'summarize';
  }
  return 'general';
}

function generateAspectExamples(prompt: string): readonly string[] {
  if (prompt.includes('compar')) {
    return [
      'Focus on practical differences and real-world implications',
      'Emphasize pros and cons of each option',
      'Highlight cost and performance trade-offs',
      'Include specific use cases for each',
    ] as const;
  }
  if (prompt.includes('explain') || prompt.includes('how')) {
    return [
      'Focus on step-by-step explanation',
      'Include real-world examples and analogies',
      'Emphasize common pitfalls and best practices',
      'Show practical implementation details',
    ] as const;
  }
  if (prompt.includes('write') || prompt.includes('create')) {
    return [
      'Focus on structure and formatting',
      'Emphasize tone and style guidelines',
      'Include specific examples and templates',
      'Highlight key elements to include',
    ] as const;
  }
  if (prompt.includes('analyz')) {
    return [
      'Focus on methodology and framework',
      'Emphasize data-driven insights',
      'Include specific metrics and KPIs',
      'Highlight actionable recommendations',
    ] as const;
  }
  return [
    'Focus on practical application',
    'Emphasize key concepts and principles',
    'Include relevant examples',
    'Highlight important considerations',
  ] as const;
}

function generateBackgroundExamples(topic: string): readonly string[] {
  const shortTopic = topic.length > 30 ? 'this topic' : topic;
  return [
    `I'm a complete beginner with ${shortTopic}`,
    `I have basic familiarity with ${shortTopic}`,
    `I'm experienced with ${shortTopic} and want advanced details`,
  ] as const;
}

function generateUseExamples(prompt: string): readonly string[] {
  if (prompt.includes('write') || prompt.includes('create')) {
    return [
      'I need to write this myself',
      'I need to present this to stakeholders',
      "I'm building a proof of concept",
    ] as const;
  }
  if (prompt.includes('learn') || prompt.includes('understand')) {
    return [
      "I'm learning this for personal knowledge",
      'I need to teach this to others',
      "I'm preparing for a project or interview",
    ] as const;
  }
  return [
    'I need to make a decision based on this',
    "I'm doing research for a project",
    'I need to explain this to my team',
  ] as const;
}

function extractTopic(prompt: string): string {
  const trimmed = prompt.trim();

  if (trimmed.length <= 50) {
    return trimmed;
  }

  const lowerPrompt = trimmed.toLowerCase();

  const starters = [
    'please ',
    'can you ',
    'could you ',
    'i want to ',
    'i need to ',
    'help me ',
    'write ',
    'create ',
    'explain ',
    'analyze ',
    'compare ',
  ] as const;
  let topic = trimmed;

  for (const starter of starters) {
    if (lowerPrompt.startsWith(starter)) {
      topic = trimmed.slice(starter.length);
      break;
    }
  }

  if (topic.length > 60) {
    topic = topic.slice(0, 57) + '...';
  }

  return topic;
}

export function generateFallbackQuestions(initialPrompt: string): Question[] {
  const prompt = initialPrompt.toLowerCase();
  const promptType = detectPromptType(prompt);
  const topic = extractTopic(initialPrompt);

  const aspectQuestion: Question = {
    id: 1,
    title: ASPECT_TITLES[promptType],
    description: ASPECT_DESCRIPTIONS[promptType](topic),
    field: 'specificAspects',
    examples: Array.from(generateAspectExamples(prompt)),
  };

  const backgroundQuestion: Question = {
    id: 2,
    title: BACKGROUND_TITLES[promptType],
    description: BACKGROUND_DESCRIPTIONS[promptType],
    field: 'backgroundLevel',
    examples: Array.from(generateBackgroundExamples(topic)),
  };

  const useQuestion: Question = {
    id: 3,
    title: USE_TITLES[promptType],
    description: USE_DESCRIPTIONS[promptType],
    field: 'intendedUse',
    examples: Array.from(generateUseExamples(prompt)),
  };

  return [aspectQuestion, backgroundQuestion, useQuestion];
}

export function buildEnhancedPrompt(initialPrompt: string, formData: FormData): string {
  let enhancedPrompt = initialPrompt;

  if (formData.specificAspects) {
    enhancedPrompt += `\n\nSpecific Focus: ${formData.specificAspects}`;
  }
  if (formData.backgroundLevel) {
    enhancedPrompt += `\n\nAudience Level: ${formData.backgroundLevel}`;
  }
  if (formData.intendedUse) {
    enhancedPrompt += `\n\nIntended Use: ${formData.intendedUse}`;
  }

  return enhancedPrompt;
}
