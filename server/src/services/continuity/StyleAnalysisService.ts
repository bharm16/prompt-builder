import { logger } from '@infrastructure/Logger';
import type { AIService } from '@services/prompt-optimization/types';
import type { StyleAnalysisMetadata } from './types';

export class StyleAnalysisService {
  private readonly log = logger.child({ service: 'StyleAnalysisService' });

  constructor(private ai: AIService) {}

  async analyzeForDisplay(imageUrl: string): Promise<StyleAnalysisMetadata> {
    try {
      const systemPrompt = `Analyze this image and provide a brief description for a UI display.
Return JSON with:
{
  "colors": ["color1", "color2", "color3"],
  "lighting": "Brief lighting description",
  "mood": "One word mood",
  "confidence": 0.0-1.0
}
Be concise. This is for display only, not generation.`;

      const response = await this.ai.execute('style_analysis', {
        systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analyze the image and return JSON.' },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
        maxTokens: 500,
        temperature: 0.1,
        jsonMode: true,
        enableBookending: false,
      });

      const parsed = JSON.parse(response.text);

      return {
        dominantColors: parsed.colors || [],
        lightingDescription: parsed.lighting || 'Unknown',
        moodDescription: parsed.mood || 'Unknown',
        confidence: parsed.confidence || 0.5,
      };
    } catch (error) {
      this.log.warn('Style analysis failed', {
        error: (error as Error).message,
      });

      return {
        dominantColors: [],
        lightingDescription: 'Unable to analyze',
        moodDescription: 'Unable to analyze',
        confidence: 0,
      };
    }
  }
}
