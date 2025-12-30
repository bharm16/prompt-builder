
import { VideoPromptAnalyzer } from '../server/src/services/video-prompt-analysis/services/analysis/VideoPromptAnalyzer';
import { wanStrategy } from '../server/src/services/video-prompt-analysis/strategies/WanStrategy';
import dotenv from 'dotenv';

dotenv.config();

async function testWanStrategy() {
  const analyzer = new VideoPromptAnalyzer();
  const input = `
A serene landscape of a misty mountain range at sunrise. A golden eagle soars through the clouds, its wings catching the first light. The valleys below are filled with thick white fog.

**TECHNICAL SPECS**
- **Camera**: Wide aerial shot, slow pan
- **Lighting**: Golden hour, soft morning light, volumetric rays
- **Duration**: 15 seconds
- **Aspect Ratio**: 16:9
- **Style**: Cinematic Nature Photography
`;

  console.log('--- ORIGINAL INPUT ---');
  console.log(input);

  console.log(`\n=== OPTIMIZING FOR: ${wanStrategy.modelName} ===`);
  try {
    // Phase 1: Normalize
    const normalized = wanStrategy.normalize(input);
    console.log('NORMALIZED:');
    console.log(normalized);

    // Phase 2: Transform (this uses Gemini)
    console.log('\nTRANSFORMING (via LLM)...');
    const result = await wanStrategy.transform(normalized);
    console.log('PROMPT:');
    if (typeof result.prompt === 'object') {
      console.log(JSON.stringify(result.prompt, null, 2));
    } else {
      console.log(result.prompt);
    }

    // Phase 3: Augment
    const augmented = wanStrategy.augment(result);
    console.log('\nAUGMENTED PROMPT:');
    console.log(augmented.prompt);

    console.log('\nMETADATA PHASES:');
    augmented.metadata.phases.forEach(p => {
      console.log(`- ${p.phase} (${p.durationMs.toFixed(2)}ms): ${p.changes.join(', ')}`);
    });
    
    console.log('\nINJECTED TRIGGERS:');
    console.log(augmented.metadata.triggersInjected.join(', '));

  } catch (error) {
    console.error(`Error optimizing for ${wanStrategy.modelName}:`, error);
  }
}

testWanStrategy()
  .then(() => {
    console.log('\n--- TEST COMPLETE ---');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
