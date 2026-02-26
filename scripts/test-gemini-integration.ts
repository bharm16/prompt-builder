import { config as loadEnv } from 'dotenv';
import { GeminiAdapter } from '../server/src/clients/adapters/GeminiAdapter.js';
import { AIModelService } from '../server/src/services/ai-model/AIModelService.js';
import { labelSpans } from '../server/src/llm/span-labeling/SpanLabelingService.js';
import { LLMClient } from '../server/src/clients/LLMClient.js';

// Load env
loadEnv();

async function main() {
  console.log('🚀 Testing Gemini Integration via Service Layer...');

  if (!process.env.GOOGLE_API_KEY && !process.env.GEMINI_API_KEY) {
    console.error('❌ GOOGLE_API_KEY or GEMINI_API_KEY required in .env');
    process.exit(1);
  }

  // 1. Setup Services
  console.log('📦 Setting up services...');
  
  const geminiAdapter = new GeminiAdapter({
    apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY!,
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-3.0-flash',
    providerName: 'gemini',
  });

  const geminiClient = new LLMClient({
    adapter: geminiAdapter,
    providerName: 'gemini',
  });

  // Mock other clients as null since we force Gemini via env var
  const aiService = new AIModelService({
    clients: {
      openai: geminiClient, // Hack: satisfy requirement, but we won't use it.
      gemini: geminiClient,
    },
  });

  // 2. Configure Environment for Factory
  process.env.SPAN_PROVIDER = 'gemini';
  process.env.SPAN_MODEL = 'gemini-3.0-flash';

  // 3. Prepare Input
  const inputText = `Medium Shot of a futuristic city with flying cars and neon lights. The camera pans slowly to reveal a cybernetic detective walking in the rain.`;
  
  console.log('\n📝 Input Text:', inputText);
  console.log('⚙️  Provider:', process.env.SPAN_PROVIDER);
  console.log('⚙️  Model:', process.env.SPAN_MODEL);

  // 4. Run Labeling
  console.log('\n🏃 Running labelSpans()...');
  const startTime = Date.now();

  try {
    const result = await labelSpans({
        text: inputText,
        policy: {
            allowOverlaps: false,
            validRoles: ['shot.type', 'subject.identity', 'environment.location', 'camera.movement'], // Subset for testing
        },
        options: {
            maxSpans: 10,
            templateVersion: 'v1',
            minConfidence: 0.7,
        },
        aiService: aiService, // Inject our service instance
    });

    const duration = Date.now() - startTime;
    console.log(`\n✅ Success in ${duration}ms`);
    console.log(`found ${result.spans.length} spans:`);
    result.spans.forEach(span => {
        console.log(`  - [${span.role}] "${span.text}" (${span.confidence})`);
    });

    if (result.spans.length === 0) {
        console.warn('⚠️  No spans found. Check debug logs or model output.');
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
  }
}

main().catch(console.error);
