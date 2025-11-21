import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoStrategy } from '../../../../server/src/services/prompt-optimization/strategies/VideoStrategy.js';
import { StructuredOutputEnforcer } from '../../../../server/src/utils/StructuredOutputEnforcer.js';

// Mock dependencies
vi.mock('../../../../server/src/utils/StructuredOutputEnforcer.js', () => ({
  StructuredOutputEnforcer: {
    enforceJSON: vi.fn(),
  },
}));

vi.mock('../../../../server/src/infrastructure/Logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

describe('VideoStrategy - Chain-of-Thought Integration', () => {
  let videoStrategy;
  let mockAiService;
  let mockTemplateService;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockAiService = {
      execute: vi.fn(),
    };
    
    mockTemplateService = {};
    
    videoStrategy = new VideoStrategy(mockAiService, mockTemplateService);
  });

  describe('optimize with structured JSON output', () => {
    it('should use StructuredOutputEnforcer to get JSON response', async () => {
      const mockJsonResponse = {
        _hidden_reasoning: 'The subject is a cat jumping (dynamic action), so I selected a tracking shot to follow the motion.',
        shot_type: 'Tracking shot',
        main_prompt: 'Tracking shot of an agile tabby cat with orange stripes mid-leap over a weathered wooden fence in a sunny suburban backyard. The camera follows the cat\'s arc smoothly at eye level, capturing the graceful motion from takeoff to landing. Golden hour sunlight streams from the right, creating warm highlights on the cat\'s fur and long shadows across the green grass. Shot on 35mm film with a shallow depth of field at f/2.8, giving the background a soft bokeh quality.',
        technical_specs: {
          duration: '4-6s',
          aspect_ratio: '16:9',
          frame_rate: '24fps',
          audio: 'natural ambience'
        },
        variations: [
          {
            type: 'Different Camera',
            prompt: 'Low angle shot of the same tabby cat jumping over the fence, emphasizing its athletic power and grace against the bright blue sky, creating a heroic perspective of this everyday feline feat.'
          },
          {
            type: 'Different Lighting/Mood',
            prompt: 'Same tracking shot but at dusk with moody twilight lighting, capturing the cat\'s silhouette against the purple-orange sky, creating a more dramatic and contemplative atmosphere.'
          }
        ]
      };

      StructuredOutputEnforcer.enforceJSON.mockResolvedValue(mockJsonResponse);

      const result = await videoStrategy.optimize({ prompt: 'A cat jumping over a fence' });

      // Verify StructuredOutputEnforcer was called
      expect(StructuredOutputEnforcer.enforceJSON).toHaveBeenCalledTimes(1);
      
      const call = StructuredOutputEnforcer.enforceJSON.mock.calls[0];
      expect(call[0]).toBe(mockAiService); // First arg is AI service
      expect(call[1]).toContain('STEP 1: INTERNAL CINEMATOGRAPHIC ANALYSIS'); // Second arg is system prompt
      expect(call[2]).toMatchObject({
        operation: 'optimize_standard',
        isArray: false,
        maxRetries: 2,
      });
    });

    it('should reassemble JSON into text format for backward compatibility', async () => {
      const mockJsonResponse = {
        _hidden_reasoning: 'Selected wide shot to establish context and scale.',
        shot_type: 'Wide shot',
        main_prompt: 'Wide shot of a peaceful meadow with rolling hills.',
        technical_specs: {
          duration: '6-8s',
          aspect_ratio: '2.39:1',
          frame_rate: '24fps',
          audio: 'cinematic score'
        },
        variations: [
          {
            type: 'Different Camera',
            prompt: 'Aerial drone shot descending into the meadow.'
          },
          {
            type: 'Different Lighting/Mood',
            prompt: 'Same wide shot but during sunrise with golden rays.'
          }
        ]
      };

      StructuredOutputEnforcer.enforceJSON.mockResolvedValue(mockJsonResponse);

      const result = await videoStrategy.optimize({ prompt: 'A peaceful meadow' });

      // Verify reassembled output contains all parts
      expect(result).toContain('Wide shot of a peaceful meadow with rolling hills.');
      expect(result).toContain('**TECHNICAL SPECS**');
      expect(result).toContain('- **Duration:** 6-8s');
      expect(result).toContain('- **Aspect Ratio:** 2.39:1');
      expect(result).toContain('- **Frame Rate:** 24fps');
      expect(result).toContain('- **Audio:** cinematic score');
      expect(result).toContain('**ALTERNATIVE APPROACHES**');
      expect(result).toContain('- **Variation 1 (Different Camera):** Aerial drone shot descending into the meadow.');
      expect(result).toContain('- **Variation 2 (Different Lighting/Mood):** Same wide shot but during sunrise with golden rays.');
    });

    it('should preserve main prompt as the first element', async () => {
      const mockJsonResponse = {
        _hidden_reasoning: 'Chose close-up for intimacy.',
        shot_type: 'Close-up',
        main_prompt: 'Close-up of weathered hands.',
        technical_specs: {
          duration: '4s',
          aspect_ratio: '16:9',
          frame_rate: '24fps',
          audio: 'mute'
        },
        variations: []
      };

      StructuredOutputEnforcer.enforceJSON.mockResolvedValue(mockJsonResponse);

      const result = await videoStrategy.optimize({ prompt: 'Hands' });

      // Main prompt should be first, before technical specs
      const mainPromptIndex = result.indexOf('Close-up of weathered hands.');
      const techSpecsIndex = result.indexOf('**TECHNICAL SPECS**');
      expect(mainPromptIndex).toBeLessThan(techSpecsIndex);
    });

    it('should handle missing variations gracefully', async () => {
      const mockJsonResponse = {
        _hidden_reasoning: 'Selected medium shot.',
        shot_type: 'Medium shot',
        main_prompt: 'Medium shot of a person walking.',
        technical_specs: {
          duration: '5s',
          aspect_ratio: '16:9',
          frame_rate: '30fps',
          audio: 'natural ambience'
        },
        variations: null // Missing variations
      };

      StructuredOutputEnforcer.enforceJSON.mockResolvedValue(mockJsonResponse);

      const result = await videoStrategy.optimize({ prompt: 'A person walking' });

      // Should not throw, and should have technical specs but no variations section
      expect(result).toContain('Medium shot of a person walking.');
      expect(result).toContain('**TECHNICAL SPECS**');
      expect(result).not.toContain('**ALTERNATIVE APPROACHES**');
    });

    it('should handle missing technical specs gracefully', async () => {
      const mockJsonResponse = {
        _hidden_reasoning: 'Selected low angle.',
        shot_type: 'Low angle',
        main_prompt: 'Low angle shot of a building.',
        technical_specs: null, // Missing specs
        variations: [
          {
            type: 'Different Camera',
            prompt: 'High angle shot of the same building.'
          }
        ]
      };

      StructuredOutputEnforcer.enforceJSON.mockResolvedValue(mockJsonResponse);

      const result = await videoStrategy.optimize({ prompt: 'A building' });

      // Should not throw, and should have main prompt and variations but no technical specs
      expect(result).toContain('Low angle shot of a building.');
      expect(result).toContain('**ALTERNATIVE APPROACHES**');
      expect(result).not.toContain('**TECHNICAL SPECS**');
    });

    it('should propagate errors from StructuredOutputEnforcer', async () => {
      const mockError = new Error('Failed to parse JSON');
      StructuredOutputEnforcer.enforceJSON.mockRejectedValue(mockError);

      await expect(
        videoStrategy.optimize({ prompt: 'A scene' })
      ).rejects.toThrow('Failed to parse JSON');
    });
  });

  describe('Chain-of-Thought verification', () => {
    it('should generate system prompt with CoT analysis steps', async () => {
      const mockJsonResponse = {
        _hidden_reasoning: 'Analysis result',
        shot_type: 'Wide shot',
        main_prompt: 'A prompt',
        technical_specs: { duration: '5s', aspect_ratio: '16:9', frame_rate: '24fps', audio: 'mute' },
        variations: []
      };

      StructuredOutputEnforcer.enforceJSON.mockResolvedValue(mockJsonResponse);

      await videoStrategy.optimize({ prompt: 'Test prompt' });

      const systemPrompt = StructuredOutputEnforcer.enforceJSON.mock.calls[0][1];
      
      // Verify CoT analysis steps are present
      expect(systemPrompt).toContain('STEP 1: INTERNAL CINEMATOGRAPHIC ANALYSIS');
      expect(systemPrompt).toContain('Subject Scale');
      expect(systemPrompt).toContain('Motion');
      expect(systemPrompt).toContain('Emotional Tone');
      expect(systemPrompt).toContain('Shot Selection Reference');
      expect(systemPrompt).toContain('STEP 2: GENERATE COMPONENTS');
    });

    it('should require JSON with _hidden_reasoning field', async () => {
      const mockJsonResponse = {
        _hidden_reasoning: 'This is the analysis',
        shot_type: 'Close-up',
        main_prompt: 'Prompt text',
        technical_specs: { duration: '4s', aspect_ratio: '16:9', frame_rate: '24fps', audio: 'mute' },
        variations: []
      };

      StructuredOutputEnforcer.enforceJSON.mockResolvedValue(mockJsonResponse);

      await videoStrategy.optimize({ prompt: 'Test' });

      const systemPrompt = StructuredOutputEnforcer.enforceJSON.mock.calls[0][1];
      
      // Verify JSON output requirements
      expect(systemPrompt).toContain('_hidden_reasoning');
      expect(systemPrompt).toContain('shot_type');
      expect(systemPrompt).toContain('main_prompt');
      expect(systemPrompt).toContain('technical_specs');
      expect(systemPrompt).toContain('variations');
    });
  });
});

