
import { VideoPromptAnalyzer } from '../server/src/services/video-prompt-analysis/services/analysis/VideoPromptAnalyzer';
import { runwayStrategy } from '../server/src/services/video-prompt-analysis/strategies/RunwayStrategy';
import { lumaStrategy } from '../server/src/services/video-prompt-analysis/strategies/LumaStrategy';
import { klingStrategy } from '../server/src/services/video-prompt-analysis/strategies/KlingStrategy';
import { soraStrategy } from '../server/src/services/video-prompt-analysis/strategies/SoraStrategy';
import { veoStrategy } from '../server/src/services/video-prompt-analysis/strategies/VeoStrategy';
import dotenv from 'dotenv';

dotenv.config();

async function testPipeline() {
  const analyzer = new VideoPromptAnalyzer();
  const input = `
A cinematic shot of a futuristic cyberpunk city at night. A lone cybernetic traveler walks through a narrow alleyway, their mechanical arm glowing with a faint blue light. Rain is falling heavily, reflecting the neon signs above.

**TECHNICAL SPECS**
- **Camera**: Tracking shot, low angle, 35mm lens
- **Lighting**: Neon signs, high contrast, volumetric fog
- **Duration**: 10 seconds
- **Aspect Ratio**: 21:9
- **Style**: Cyberpunk Realism, inspired by Blade Runner
- **Audio**: Ambient rain, distant synth music, electronic hum
`;

  console.log('--- ORIGINAL INPUT ---');
  console.log(input);

  console.log('\n--- ANALYZING IR ---');
  const ir = await analyzer.analyze(input);
  console.log(JSON.stringify(ir, null, 2));

  const strategies = [
    runwayStrategy,
    lumaStrategy,
    klingStrategy,
    soraStrategy,
    veoStrategy
  ];

  for (const strategy of strategies) {
    console.log(`\n=== OPTIMIZING FOR: ${strategy.modelName} ===`);
    try {
      const result = await strategy.transform(input);
      console.log('PROMPT:');
      if (typeof result.prompt === 'object') {
        console.log(JSON.stringify(result.prompt, null, 2));
      } else {
        console.log(result.prompt);
      }
      console.log('\nMETADATA PHASES:');
      result.metadata.phases.forEach(p => {
        console.log(`- ${p.phase}: ${p.changes.join(', ')}`);
      });
    } catch (error) {
      console.error(`Error optimizing for ${strategy.modelName}:`, error);
    }
  }
}

testPipeline()
  .then(() => {
    console.log('\n--- TEST COMPLETE ---');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });

