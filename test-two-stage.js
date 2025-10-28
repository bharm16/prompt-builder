import dotenv from 'dotenv';
import { OpenAIAPIClient } from './server/src/clients/OpenAIAPIClient.js';
import { PromptOptimizationService } from './server/src/services/PromptOptimizationService.js';

// Load environment variables
dotenv.config();

// Test prompt from user
const testPrompt = `debug memory leak in my react hooks`;

async function runTest() {
  console.log('🧪 Testing Two-Stage Domain-Specific Content Generation\n');
  console.log('=' .repeat(80));
  console.log('📝 Test Prompt:');
  console.log(testPrompt);
  console.log('=' .repeat(80));
  console.log();

  // Initialize OpenAI client
  const client = new OpenAIAPIClient(process.env.OPENAI_API_KEY, {
    timeout: 60000,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  });

  // Initialize optimization service
  const service = new PromptOptimizationService(client);

  console.log('⏳ Running optimization with two-stage flow...\n');

  try {
    const result = await service.optimize({
      prompt: testPrompt,
      mode: 'reasoning',
      // No context provided - will trigger auto-inference
    });

    console.log('=' .repeat(80));
    console.log('✅ OPTIMIZED OUTPUT:');
    console.log('=' .repeat(80));
    console.log(result);
    console.log('=' .repeat(80));
    console.log();
    console.log('🎯 Test complete! Check the output above for domain-specific content.');
    console.log();
    console.log('Expected improvements:');
    console.log('  - Domain-specific warnings about DOM manipulation, parsing, rendering');
    console.log('  - Technical deliverables like flame graphs, profiling data');
    console.log('  - Specific constraints around performance metrics');
    console.log();

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the test
runTest();
