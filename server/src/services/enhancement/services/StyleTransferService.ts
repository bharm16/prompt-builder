import { logger } from '@infrastructure/Logger';
import { STYLE_DEFINITIONS, DEFAULT_STYLE } from '../config/styleDefinitions.js';
import type { AIService } from './types.js';

/**
 * Service responsible for transferring text between different writing styles
 */
export class StyleTransferService {
  constructor(private readonly ai: AIService) {}

  /**
   * Transfer text from one style to another
   * @param text - Text to transform
   * @param targetStyle - Target style (technical, creative, academic, casual, formal)
   * @returns Transformed text
   */
  async transferStyle(text: string, targetStyle: string): Promise<string> {
    const styleConfig = STYLE_DEFINITIONS[targetStyle as keyof typeof STYLE_DEFINITIONS] || STYLE_DEFINITIONS[DEFAULT_STYLE as keyof typeof STYLE_DEFINITIONS];

    const styleTransferPrompt = this._buildStyleTransferPrompt(text, targetStyle, styleConfig);

    try {
      const response = await this.ai.execute('enhance_style_transfer', {
        systemPrompt: styleTransferPrompt,
        maxTokens: 1024,
        temperature: 0.7,
      });

      return (response.text || (response as { content?: Array<{ text?: string }> }).content?.[0]?.text || '').trim();
    } catch (error) {
      logger.warn('Failed to transfer style', { error });
      return text; // Return original on error
    }
  }

  /**
   * Build style transfer prompt
   * @private
   */
  private _buildStyleTransferPrompt(text: string, targetStyle: string, styleConfig: typeof STYLE_DEFINITIONS[keyof typeof STYLE_DEFINITIONS]): string {
    return `Transform the following text to ${targetStyle} style while preserving its core meaning and information.

Original text: "${text}"

Target style characteristics:
- Formality level: ${styleConfig.formality}
- Language type: ${styleConfig.jargon}
- Structure: ${styleConfig.structure}
- Tone: ${styleConfig.tone}
- Examples style: ${styleConfig.examples}

Requirements:
1. Maintain all factual information from the original
2. Adapt vocabulary to match the target style
3. Restructure sentences appropriately for the style
4. Preserve the core message and intent
5. Make it feel natural in the new style

Provide ONLY the transformed text, no explanations:`;
  }
}

