import type { RewriteConstraints } from '../../../strategies/types';
import type { PromptBuildContext } from './types';

const formatConstraintBlock = (constraints: RewriteConstraints): string => {
  const sections: string[] = [];
  const { mandatory, suggested, avoid } = constraints;

  if (mandatory && mandatory.length > 0) {
    sections.push(
      `MANDATORY CONSTRAINTS (must appear, paraphrased if needed):\n- ${mandatory.join('\n- ')}`
    );
  }

  if (suggested && suggested.length > 0) {
    sections.push(`SUGGESTED CONSTRAINTS (include when natural):\n- ${suggested.join('\n- ')}`);
  }

  if (avoid && avoid.length > 0) {
    sections.push(`AVOID (do not include these words/phrases):\n- ${avoid.join('\n- ')}`);
  }

  if (sections.length === 0) {
    return '';
  }

  return `\nCONSTRAINTS:\n${sections.join('\n')}\n`;
};

export const buildBaseHeader = ({ ir, modelId, constraints }: PromptBuildContext): string => {
  const irJson = JSON.stringify(ir, null, 2);
  const constraintBlock = formatConstraintBlock(constraints);

  return `You are a professional video prompt engineer. Your goal is to rewrite the original user intent into an optimized prompt for the ${modelId} video generation model.

Below is the structured Intermediate Representation (IR) of the user's request, which includes the narrative description, subjects, actions, camera movements, environment, audio, and technical specifications. Use this structured data to generate a high-fidelity prompt.

Video Prompt IR:
\`\`\`json
${irJson}
\`\`\`

${constraintBlock}`;
};
