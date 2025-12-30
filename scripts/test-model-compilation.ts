
import dotenv from 'dotenv';
import path from 'path';
import { configureServices, initializeServices } from '../server/src/config/services.config';
import { logger } from '../server/src/infrastructure/Logger';

// Load environment variables from .env file in root
const result = dotenv.config({ path: path.join(process.cwd(), '.env') });
if (result.error) {
  console.error('Error loading .env file:', result.error);
}
console.log('Environment loaded.');
console.log('GEMINI_API_KEY exists:', !!process.env.GEMINI_API_KEY);
if (process.env.GEMINI_API_KEY) {
    console.log('GEMINI_API_KEY length:', process.env.GEMINI_API_KEY.length);
}

async function runTest() {
  console.log('🚀 Starting Model Compilation Test Script');
  console.log('---------------------------------------');

  const inputPrompt = "man staring out of a window";
  console.log(`\nInput Prompt: "${inputPrompt}"`);

  // 1. Initialize Services
  console.log('\nInitializing services...');
  let container;
  try {
    container = await configureServices();
    // We attempt to initialize. If it fails (e.g. API keys), we might need to mock or handle it.
    // However, for this script, we can try to resolve services even if full health check fails,
    // provided we catch the error. But initializeServices throws if OpenAI fails.
    // Let's try to bypass health checks if we only want to test compilation logic?
    // No, let's try standard init first.
    try {
        await initializeServices(container);
    } catch (e) {
        console.warn('⚠️ Service initialization had issues (likely missing API keys). attempting to proceed with partial functionality...');
    }
  } catch (error) {
    console.error('❌ Failed to configure services:', error);
    process.exit(1);
  }

  // 2. Resolve required services
  const promptOptService = container.resolve('promptOptimizationService');
  const videoService = container.resolve('videoService');

  if (!promptOptService || !videoService) {
    console.error('❌ Failed to resolve required services.');
    process.exit(1);
  }

  // 3. Generate "Base" Optimized Prompt
  console.log('\n--- Step 1: Generating Generic Optimized Prompt ---');
  let optimizedPrompt;
  
  try {
    // Attempt real optimization
    console.log('Attempting optimization via LLM...');
    optimizedPrompt = await promptOptService.optimize({
      prompt: inputPrompt,
      mode: 'video',
      maxTokens: 10000
    });
    console.log('✅ Optimization successful!');
    console.log(`Generic Optimized Prompt:\n"${optimizedPrompt}"`);
  } catch (error) {
    console.warn(`⚠️ Optimization failed: ${(error as Error).message}`);
    console.warn('Falling back to a simulated optimized prompt for testing compilation.');
    
    // Fallback prompt for testing purposes
    optimizedPrompt = "Cinematic medium close-up of an elderly man with weathered features staring contemplatively out of a rain-streaked window in a dimly lit study. Soft natural lighting from the overcast sky illuminates his face, highlighting deep sorrow. Shot on 35mm film, melancholic atmosphere, high contrast, static camera composition.";
    console.log(`\nUsing Simulated Prompt:\n"${optimizedPrompt}"`);
  }

  // 4. Run through each model
  console.log('\n--- Step 2: Compiling for Each Target Model ---');

  const supportedModels = videoService.getSupportedModelIds();
  console.log(`Supported Models: ${supportedModels.join(', ')}\n`);

  // Collect all outputs for final summary
  const outputLog: string[] = [];

  for (const modelId of supportedModels) {
    console.log(`\n👉 Processing for Model: ${modelId.toUpperCase()}`);
    console.log('-'.repeat(40));

    try {
      const result = await videoService.optimizeForModel(optimizedPrompt, modelId);

      if (result.metadata?.warnings?.length > 0) {
        console.warn('  ⚠️ Warnings:', result.metadata.warnings);
      }

      const isJson = typeof result.prompt !== 'string';
      const output = isJson ? JSON.stringify(result.prompt, null, 2) : result.prompt;

      console.log(`  Output:\n  ${output.replace(/\n/g, '\n  ')}`);

      if (result.metadata?.phases) {
        const changes = result.metadata.phases.flatMap(p => p.changes).length;
        console.log(`  (Applied ${changes} modifications via pipeline)`);
      }

      // Add to output log for summary with better formatting
      outputLog.push(`\n--- ${modelId.toUpperCase()} ---`);
      if (result.metadata?.warnings?.length > 0) {
        outputLog.push(`Warnings: ${JSON.stringify(result.metadata.warnings)}`);
      }

      // Format the output with better spacing
      let formattedOutput = output;
      if (!isJson) {
        // Add generous spacing around sections for readability
        formattedOutput = formattedOutput
          .replace(/\*\*TECHNICAL SPECS\*\*/g, '\n\n**TECHNICAL SPECS**')
          .replace(/\*\*ALTERNATIVE APPROACHES\*\*/g, '\n\n**ALTERNATIVE APPROACHES**')
          // Add spacing after bullet lists
          .replace(/- \*\*Camera:\*\*/g, '\n- **Camera:**')
          .replace(/- \*\*Lighting:\*\*/g, '\n- **Lighting:**')
          .replace(/- \*\*Style:\*\*/g, '\n- **Style:**')
          .replace(/- \*\*Variation 1/g, '\n- **Variation 1')
          .replace(/- \*\*Variation 2/g, '\n- **Variation 2');
      }

      outputLog.push(`\n${formattedOutput}\n`);
      if (result.metadata?.phases) {
        const changes = result.metadata.phases.flatMap(p => p.changes).length;
        outputLog.push(`\n(Applied ${changes} modifications via pipeline)`);
      }

    } catch (error) {
      console.error(`  ❌ Failed for ${modelId}:`, (error as Error).message);
      outputLog.push(`\n--- ${modelId.toUpperCase()} ---`);
      outputLog.push(`ERROR: ${(error as Error).message}`);
    }
  }

  console.log('\n---------------------------------------');
  console.log('✅ Test Complete');

  // Wait for async logs to flush before printing summary
  await new Promise(resolve => setTimeout(resolve, 100));

  // Print summary
  console.log('\n\n========================================');
  console.log('MODEL-SPECIFIC PROMPTS');
  console.log('========================================');
  console.log(`\nOriginal Input: "${inputPrompt}"`);
  console.log(`\nGeneric Optimized Prompt:\n${optimizedPrompt}\n`);
  console.log('\n' + '='.repeat(60));
  console.log('COMPILED PROMPTS FOR EACH MODEL');
  console.log('='.repeat(60));
  console.log(outputLog.join('\n'));
}

runTest().catch(console.error);