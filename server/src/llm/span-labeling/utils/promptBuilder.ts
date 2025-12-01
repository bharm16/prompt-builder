import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { TAXONOMY, VALID_CATEGORIES } from '#shared/taxonomy.js';
import { SemanticRouter } from '../routing/SemanticRouter.js';
import { IMMUTABLE_SOVEREIGN_PREAMBLE } from '@utils/SecurityPrompts.js';
import { 
  TYPESCRIPT_INTERFACE_DEFINITION, 
  CATEGORY_MAPPING_TABLE,
  DISAMBIGUATION_RULES,
  VALID_TAXONOMY_IDS 
} from '../schemas/SpanLabelingSchema.js';

// Load condensed prompt template
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const condensedPromptPath = join(__dirname, '..', 'templates', 'span-labeling-prompt-condensed.md');
const CONDENSED_PROMPT_TEMPLATE = readFileSync(condensedPromptPath, 'utf-8');

/**
 * Build system prompt using condensed template with schema injection
 * 
 * Llama 3 PDF Best Practices Applied:
 * - Section 3.3: TypeScript interface for token efficiency (60% reduction)
 * - Section 5.1: XML tagging structure
 * - Section 3.1: All constraints in system block (GAtt mechanism)
 * 
 * @param text - Input text (used for semantic routing if enabled)
 * @param useRouter - Whether to use semantic router for example injection
 * @param provider - Provider name for schema format selection ('groq' | 'openai')
 */
export function buildSystemPrompt(
  text: string = '', 
  useRouter: boolean = false,
  provider: string = 'groq'
): string {
  // Generate taxonomy ID list from VALID_TAXONOMY_IDS
  const taxonomyIdList = VALID_TAXONOMY_IDS.map(id => `\`${id}\``).join(', ');
  
  // Build condensed prompt with schema injection
  let systemPrompt = CONDENSED_PROMPT_TEMPLATE
    .replace('{{{TYPESCRIPT_INTERFACE}}}', TYPESCRIPT_INTERFACE_DEFINITION)
    .replace('{{{TAXONOMY_IDS}}}', taxonomyIdList)
    .replace('{{{CATEGORY_TABLE}}}', CATEGORY_MAPPING_TABLE)
    .replace('{{{DISAMBIGUATION_RULES}}}', DISAMBIGUATION_RULES);
  
  // Add security preamble (GPT-4o Best Practices Section 2.1)
  systemPrompt = `${IMMUTABLE_SOVEREIGN_PREAMBLE}\n\n${systemPrompt}`;

  // PDF Design B: Example injection DISABLED - example banks have invalid taxonomy IDs
  // TODO: Fix routing/examples/*.js to use valid taxonomy IDs, then re-enable:
  // if (useRouter && text) {
  //   const router = new SemanticRouter();
  //   const examples = router.formatExamplesForPrompt(text);
  //   if (examples) {
  //     systemPrompt += examples;
  //   }
  // }

  return systemPrompt.trim();
}

/**
 * Build few-shot examples as message array (not embedded in system prompt)
 * 
 * Llama 3 PDF Section 3.3: "Multi-Part Prompting: Instead of one massive prompt..."
 * Examples as user/assistant pairs are more effective than embedded in system prompt
 * 
 * @returns Array of few-shot example messages
 */
export function buildFewShotExamples(): Array<{ role: 'user' | 'assistant'; content: string }> {
  return [
    // Example 1: Basic span labeling with split pattern
    {
      role: 'user',
      content: '<user_input>Close-up shot of weathered hands</user_input>'
    },
    {
      role: 'assistant',
      content: JSON.stringify({
        analysis_trace: "Identified shot type and physical appearance. 'Close-up shot' is shot framing. 'weathered hands' describes physical traits.",
        spans: [
          { text: "Close-up shot", role: "shot.type", confidence: 0.95 },
          { text: "weathered hands", role: "subject.appearance", confidence: 0.9 }
        ],
        meta: { version: "v3", notes: "Split shot type from appearance" },
        isAdversarial: false
      }, null, 2)
    },
    
    // Example 2: Camera movement (disambiguation)
    {
      role: 'user',
      content: '<user_input>camera slowly pans left</user_input>'
    },
    {
      role: 'assistant',
      content: JSON.stringify({
        analysis_trace: "Camera verb 'pans' with modifiers indicates camera.movement. Keep entire phrase together.",
        spans: [
          { text: "camera slowly pans left", role: "camera.movement", confidence: 0.95 }
        ],
        meta: { version: "v3", notes: "Kept camera movement as single span with modifiers" },
        isAdversarial: false
      }, null, 2)
    },
    
    // Example 3: Technical specs extraction
    {
      role: 'user',
      content: '<user_input>**TECHNICAL SPECS**\n- **Duration:** 4-8s\n- **Frame Rate:** 24fps</user_input>'
    },
    {
      role: 'assistant',
      content: JSON.stringify({
        analysis_trace: "Technical metadata section. Extract values: duration and frame rate.",
        spans: [
          { text: "4-8s", role: "technical.duration", confidence: 0.95 },
          { text: "24fps", role: "technical.frameRate", confidence: 0.95 }
        ],
        meta: { version: "v3", notes: "Extracted technical values only, not labels" },
        isAdversarial: false
      }, null, 2)
    }
  ];
}

/**
 * Build complete message array for span labeling
 * 
 * Llama 3 PDF Section 3.2: Sandwich prompting structure
 * 1. System: Full constraints
 * 2. Few-shot examples
 * 3. Actual user input
 * 4. Sandwich reminder (format constraint)
 * 
 * @param text - User input text to label
 * @param includeFewShot - Whether to include few-shot examples
 * @param provider - Provider name for optimization
 */
export function buildSpanLabelingMessages(
  text: string,
  includeFewShot: boolean = true,
  provider: string = 'groq'
): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [];
  
  // 1. System prompt with all constraints
  messages.push({
    role: 'system',
    content: buildSystemPrompt(text, false, provider)
  });
  
  // 2. Few-shot examples (if enabled)
  if (includeFewShot) {
    const examples = buildFewShotExamples();
    messages.push(...examples);
  }
  
  // 3. Actual user input wrapped in XML tags
  messages.push({
    role: 'user',
    content: `<user_input>
${text}
</user_input>

Process the text above and return the span labels as JSON.`
  });
  
  // 4. Sandwich reminder for format adherence (Llama 3 PDF Section 3.2)
  if (provider === 'groq') {
    messages.push({
      role: 'user',
      content: 'Output ONLY valid JSON. No markdown code blocks, no explanatory text.'
    });
  }
  
  return messages;
}

// Generate base system prompt at module initialization
export const BASE_SYSTEM_PROMPT = buildSystemPrompt('', false, 'groq');

// Re-export for backward compatibility
export { buildSystemPrompt as buildContextAwareSystemPrompt };
