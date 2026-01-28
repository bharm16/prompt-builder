import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// 1. Setup & Configuration
const API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';

if (!API_KEY) {
  console.error("❌ Error: GOOGLE_API_KEY or GEMINI_API_KEY is not set in the environment.");
  process.exit(1);
}

console.log("🔍 Diagnostic Mode: Listing available models for this API key...");

try {
  // 1. Fetch available models
  const listCmd = `curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}"`;
  const listOutput = execSync(listCmd, { encoding: 'utf-8' });
  const listJson = JSON.parse(listOutput);

  if (!listJson.models) {
    console.error("❌ Failed to list models. Response:", listOutput);
    process.exit(1);
  }

  // 2. Find a "Flash" model
  // We prefer 'gemini-3.0-flash' variants.
  const availableModels = listJson.models.map(m => m.name.replace('models/', ''));
  console.log("📋 Available Models:", availableModels.join(', '));

  let selectedModel = availableModels.find(m => m === 'gemini-3.0-flash');
  if (!selectedModel) selectedModel = availableModels.find(m => m.includes('2.5') && m.includes('flash'));
  if (!selectedModel) selectedModel = availableModels.find(m => m === 'gemini-1.5-flash');
  if (!selectedModel) selectedModel = availableModels.find(m => m.includes('flash') && !m.includes('8b')); // 8b is often preview
  if (!selectedModel) selectedModel = availableModels.find(m => m.includes('gemini-1.5-pro'));
  if (!selectedModel) selectedModel = availableModels[0];

  if (!selectedModel) {
    console.error("❌ No suitable Gemini models found.");
    process.exit(1);
  }

  console.log(`✅ Selected Model: ${selectedModel}`);

  // 3. The Input Text
  const INPUT_TEXT = `Medium Shot of a woman with bright blue sports jersey... (truncated for brevity)`;

  // 4. The Taxonomy / System Instruction
  const SYSTEM_INSTRUCTION = `You are an expert video prompt analyzer... (truncated for brevity)`;

  // 5. Construct Payload
  const payload = {
    contents: [{
      role: "user",
      parts: [{ text: "Medium Shot of a woman with bright blue sports jersey, white high-top sneakers, and black braided hair dribbling a basketball with precision and agility in an outdoor basketball court with painted lines at mid-morning. The camera uses handheld tracking from a low angle with selective focus (f/4-f/5.6) to guide attention to the main action. Lit by natural daylight from the sun, casting soft shadows. Style reference: Shot with sports photography clarity.\n\n**TECHNICAL SPECS**\n- **Duration:** 6s\n- **Aspect Ratio:** 16:9\n- **Frame Rate:** 60fps\n- **Audio:** Sound of sneakers on court and ball dribbling\n- **Camera:** Low-angle handheld tracking with a 50mm lens, f/2.8\n- **Lighting:** Natural daylight from the sun, high CRI\n- **Style:** Dynamic sports photography" }]
    }],
    systemInstruction: {
      parts: [{ text: "You are an expert video prompt analyzer. Extract spans using the taxonomy: shot.type, subject.identity, etc. Return JSON with 'spans' array." }]
    },
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1
    }
  };

  const payloadPath = path.join(process.cwd(), 'payload.json');
  fs.writeFileSync(payloadPath, JSON.stringify(payload, null, 2));

  console.log("\n🚀 Starting Span Extraction Test...");
  console.log(`Input Length: ${INPUT_TEXT.length} chars`);

  // 6. Execute curl with selected model
  const curlCommand = `curl -s -w "\n%{time_total}" -X POST "https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${API_KEY}" -H 'Content-Type: application/json' -d @${payloadPath}`;

  const startTime = performance.now();
  const output = execSync(curlCommand, { encoding: 'utf-8' });
  const endTime = performance.now();

  const parts = output.trim().split('\n');
  const timeTotalStr = parts.pop(); 
  const jsonResponseStr = parts.join('\n');

  console.log("---------------------------------------------------");
  try {
    const response = JSON.parse(jsonResponseStr);
    
    if (response.error) {
       console.error("❌ API Error:", JSON.stringify(response.error, null, 2));
    } else {
        const candidate = response.candidates?.[0];
        const textContent = candidate?.content?.parts?.[0]?.text;
        
        if (textContent) {
            const parsedContent = JSON.parse(textContent);
            console.log("✅ Success! Extracted Spans:");
            console.log(JSON.stringify(parsedContent, null, 2));
            console.log(`\n📊 Span Count: ${parsedContent.spans.length}`);
        } else {
            console.error("❌ Unexpected response format:", JSON.stringify(response, null, 2));
        }
    }
  } catch (e) {
    console.error("❌ Failed to parse response JSON:", e);
    console.log("Raw Output:", jsonResponseStr);
  }

  console.log("---------------------------------------------------");
  console.log(`⏱️  Total Latency (curl): ${timeTotalStr}s`);
  console.log(`⏱️  Script Measured Latency: ${(endTime - startTime).toFixed(2)}ms`);

} catch (error) {
  console.error("❌ Script execution failed:", error.message);
} finally {
  if (fs.existsSync('payload.json')) fs.unlinkSync('payload.json');
}
