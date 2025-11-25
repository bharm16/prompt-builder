import { logger } from '@infrastructure/Logger.ts';
import OptimizationConfig from '@config/OptimizationConfig.js';

/**
 * Service for detecting the optimal optimization mode for a prompt
 * Uses keyword matching and Claude analysis
 */
export class ModeDetectionService {
  constructor(aiService) {
    this.ai = aiService;
  }

  /**
   * Detect optimal mode for the given prompt
   * @param {string} prompt - The user's prompt
   * @returns {Promise<string>} Detected mode (reasoning|research|socratic|video|optimize)
   */
  async detectMode(prompt) {
    logger.info('Detecting optimal mode', { promptLength: prompt.length });

    try {
      // Try keyword-based detection first (fast)
      const keywordMode = this.detectModeByKeywords(prompt);

      if (keywordMode) {
        logger.info('Mode detected by keywords', { mode: keywordMode });
        return keywordMode;
      }

      // Fall back to Claude-based analysis
      const claudeMode = await this.detectModeWithClaude(prompt);
      logger.info('Mode detected by Claude', { mode: claudeMode });
      return claudeMode;

    } catch (error) {
      logger.error('Mode detection failed, using default', { error: error.message });
      return OptimizationConfig.modeDetection.defaultMode;
    }
  }

  /**
   * Detect mode using keyword matching
   * @private
   */
  detectModeByKeywords(prompt) {
    const text = prompt.toLowerCase();

    const modeKeywords = {
      video: {
        keywords: ['video', 'scene', 'camera', 'shot', 'footage', 'film', 'cinematic', 'visual', 'animation'],
        weight: 1.0
      },
      reasoning: {
        keywords: ['analyze', 'reason', 'think', 'logic', 'evaluate', 'assess', 'determine', 'conclude', 'infer', 'deduce'],
        weight: 0.8
      },
      research: {
        keywords: ['research', 'investigate', 'study', 'explore', 'examine', 'survey', 'review', 'sources', 'literature', 'findings'],
        weight: 0.9
      },
      socratic: {
        keywords: ['learn', 'teach', 'understand', 'explain', 'guide', 'question', 'educate', 'tutor', 'pedagogy'],
        weight: 0.7
      }
    };

    let maxScore = 0;
    let detectedMode = null;

    for (const [mode, { keywords, weight }] of Object.entries(modeKeywords)) {
      const score = this.calculateModeScore(text, keywords, weight);

      if (score > maxScore) {
        maxScore = score;
        detectedMode = mode;
      }
    }

    // Only return if confidence is high enough
    if (maxScore >= OptimizationConfig.modeDetection.minConfidenceThreshold) {
      return detectedMode;
    }

    return null;
  }

  /**
   * Calculate score for a mode based on keywords
   * @private
   */
  calculateModeScore(text, keywords, weight = 1.0) {
    let score = 0;
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\w*\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        score += matches.length * weight;
      }
    }
    return score / text.split(/\s+/).length; // Normalize by word count
  }

  /**
   * Detect mode using Claude analysis
   * @private
   */
  async detectModeWithClaude(prompt) {
    const analysisPrompt = `Analyze this prompt and determine the best optimization mode.

<prompt>
${prompt}
</prompt>

Modes:
- **reasoning**: Analytical, problem-solving, evaluation, decision-making
- **research**: Investigation, literature review, exploration of topic
- **socratic**: Learning, teaching, understanding concepts
- **video**: Visual content, scenes, cinematography
- **optimize**: General improvement (default)

Output ONLY the mode name (one word): reasoning, research, socratic, video, or optimize.`;

    const response = await this.ai.execute('optimize_mode_detection', {
      systemPrompt: analysisPrompt,
      maxTokens: OptimizationConfig.tokens.modeDetection,
      temperature: OptimizationConfig.temperatures.modeDetection,
      timeout: OptimizationConfig.timeouts.modeDetection,
    });

    const mode = response.content[0].text.trim().toLowerCase();

    // Validate mode
    const validModes = ['reasoning', 'research', 'socratic', 'video', 'optimize'];
    if (validModes.includes(mode)) {
      return mode;
    }

    return OptimizationConfig.modeDetection.defaultMode;
  }
}

export default ModeDetectionService;

