import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { TAXONOMY } from '#shared/taxonomy.js';
import { SemanticRouter } from '../routing/SemanticRouter.js';

// Load detection patterns and rules from template file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const promptTemplatePath = join(__dirname, '..', 'templates', 'span-labeling-prompt.md');
const PROMPT_TEMPLATE = readFileSync(promptTemplatePath, 'utf-8');

/**
 * Extract the detection patterns section from the template
 * This keeps the detailed role definitions and examples from the template file
 */
function extractDetectionPatterns(template: string): string {
  // Extract everything from "## Role Definitions" to "## Rules"
  const match = template.match(/## Role Definitions with Detection Patterns([\s\S]*?)## Critical Instructions/);
  return match ? match[1].trim() : '';
}

/**
 * Extract the rules and examples section from the template
 * This keeps the operational guidelines from the template file
 */
function extractRulesSection(template: string): string {
  // Extract everything from "## Critical Instructions" onwards
  const match = template.match(/## Critical Instructions([\s\S]*)/);
  return match ? match[0].trim() : '';
}

/**
 * Build system prompt dynamically from taxonomy.js
 * Generates the taxonomy structure section while preserving detection patterns from template
 * 
 * NOTE: SemanticRouter example injection is DISABLED because the example banks
 * contain invalid taxonomy IDs (e.g., metaphor.simile, camera.technique, etc.)
 * that teach the model wrong categories. Re-enable after fixing example banks.
 * 
 * @see routing/examples/*.js - These files need taxonomy ID fixes before re-enabling
 */
export function buildSystemPrompt(text: string = '', useRouter: boolean = false): string {
  // Generate taxonomy structure from shared/taxonomy.js
  const parentCategories = Object.values(TAXONOMY)
    .map(cat => `- \`${cat.id}\` - ${cat.description}`)
    .join('\n');

  const attributeSections = Object.values(TAXONOMY)
    .map(cat => {
      if (!cat.attributes || Object.keys(cat.attributes).length === 0) {
        return null;
      }
      const attrs = Object.values(cat.attributes).map(id => `\`${id}\``).join(', ');
      return `- ${cat.label}: ${attrs}`;
    })
    .filter((section): section is string => section !== null)
    .join('\n');

  // Load detection patterns from template
  const detectionPatterns = extractDetectionPatterns(PROMPT_TEMPLATE);
  const rulesSection = extractRulesSection(PROMPT_TEMPLATE);

  // Build complete system prompt
  let systemPrompt = `# Span Labeling System Prompt

Label spans for AI video prompt elements using our unified taxonomy system.

**IMPORTANT: Respond ONLY with valid JSON. No markdown, no explanatory text, just pure JSON.**

## Taxonomy Structure

Our taxonomy has **${Object.keys(TAXONOMY).length} parent categories**, each with specific attributes:

**PARENT CATEGORIES (use when general):**
${parentCategories}

**ATTRIBUTES (use when specific):**
${attributeSections}

${detectionPatterns}

${rulesSection}
`.trim();

  // PDF Design B: Example injection DISABLED - example banks have invalid taxonomy IDs
  // TODO: Fix routing/examples/*.js to use valid taxonomy IDs, then re-enable:
  // if (useRouter && text) {
  //   const router = new SemanticRouter();
  //   const examples = router.formatExamplesForPrompt(text);
  //   if (examples) {
  //     systemPrompt += examples;
  //   }
  // }

  return systemPrompt;
}

// Generate base system prompt at module initialization (without context-specific examples)
export const BASE_SYSTEM_PROMPT = buildSystemPrompt('', false);

