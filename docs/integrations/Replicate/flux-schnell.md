# FLUX.1 [schnell] - Complete Comprehensive Documentation

## Table of Contents
- [Model Overview](#model-overview)
- [Quick Stats](#quick-stats)
- [Pricing](#pricing)
- [Key Features](#key-features)
- [Technical Architecture](#technical-architecture)
- [API Parameters](#api-parameters)
- [API Usage & Integration](#api-usage--integration)
- [Code Examples](#code-examples)
- [Examples & Use Cases](#examples--use-cases)
- [Implementation & Repositories](#implementation--repositories)
- [Performance Characteristics](#performance-characteristics)
- [Limitations](#limitations)
- [Prohibited Uses](#prohibited-use-cases-out-of-scope)
- [Fine-Tuning & Training](#training--fine-tuning)
- [Related Models](#related-flux-models)
- [External Resources](#external-resources)
- [Practical Tips](#practical-tips)
- [Status & Support](#status--support)

## Model Overview

- **Model ID:** `black-forest-labs/flux-schnell`
- **Creator:** Black Forest Labs
- **Model Type:** 12 Billion Parameter Rectified Flow Transformer
- **Status:** Official Model (Always-on, Warm Start)
- **Training Method:** Latent Adversarial Diffusion Distillation (ADD)
- **License:** Apache 2.0
- **Commercial Use:** Allowed
- **Model Created:** July 30, 2024, 12:32 a.m.
- **Last Updated:** June 25, 2025, 8:02 p.m.

### One-Line Description
"The fastest image generation model tailored for local development and personal use"

## Quick Stats

| Metric | Value |
|--------|-------|
| **Total Runs** | 592.7M (highest among fast models) |
| **Generation Speed** | 0.83 seconds |
| **Inference Steps** | 1-4 (4 recommended) |
| **Parameters** | 12 Billion |
| **Quality Level** | High |
| **Prompt Adherence** | Excellent (matches closed-source models) |
| **Cold Start Time** | Warm (pre-booted) |
| **Model Status** | Official |
| **Availability** | Always-on |

## Pricing

- **Cost:** $3 per 1,000 output images
- **Per-Image Cost:** $0.003
- **Bulk Equivalent:** ~333 images for $1
- **Pricing Model:** Per output image
- **Commercial Usage:** Fully supported and allowed
- **Volume Pricing:** Available (contact sales@replicate.com)

## Key Features

### 1. Cutting-Edge Output Quality
- Competitive prompt following matching performance of closed-source models
- State-of-the-art image generation quality at ultra-fast speeds
- Exceptional balance between speed and visual quality
- Fine detail preservation despite minimal inference steps

### 2. Latent Adversarial Diffusion Distillation (ADD)
- Advanced training technique enabling fast generation without quality loss
- Trained using sophisticated distillation from larger models
- Can generate high-quality images in only 1-4 inference steps
- Maintains visual quality even with minimal computational steps

### 3. Apache 2.0 License
- Open source and freely available
- Can be used for personal, scientific, and commercial purposes
- Full legal rights for commercial deployment
- No restrictions on derivative works

### 4. Speed Optimization
- Fastest image generation model tailored for local development and personal use
- Supports multiple inference step configurations (1-4)
- Optional accelerated inference mode (go_fast flag for FP8 quantization)
- Sub-1 second generation times

### 5. Broad Aspect Ratio Support
11 different aspect ratios including:

- **Square:** 1:1
- **Widescreen:** 16:9, 21:9
- **Landscape:** 3:2, 5:4, 4:3
- **Portrait:** 2:3, 4:5, 3:4, 9:16
- **Ultrawide:** 21:9
- **Ultravertical:** 9:21

### 6. Output Format Flexibility
- **WebP** (default, best compression) - recommended for web
- **JPG** (standard compression) - broad compatibility
- **PNG** (lossless) - for maximum quality
- Configurable quality (0-100 scale)

### 7. Reproducible Generation
- Seed parameter for consistent results
- Deterministic output with same seed
- Useful for A/B testing and iteration

### 8. Batch Processing
- Generate up to 4 images simultaneously
- Parallel processing capability
- More efficient than sequential generation

## Technical Architecture

- **Architecture Type:** Rectified Flow Transformer
- **Distillation Method:** Latent Adversarial Diffusion Distillation (ADD)
- **Model Size:** 12 billion parameters
- **Inference Type:** Minimal step diffusion (1-4 steps)
- **Optimization Options:**
  - FP8 quantization (via go_fast flag) for further speedup
  - Standard inference mode for full precision

**Key Technical Properties:**
- Latent space diffusion (operates in compressed representation)
- Flow-based matching objective
- Distilled from larger base models
- Optimized for inference speed without sacrificing quality

## API Parameters

### Input Parameters

#### `prompt` (required)
- **Type:** String
- **Description:** Text prompt for image generation
- **Max Length:** Unlimited (but long prompts may lose clarity)
- **Example:** `"black forest gateau cake spelling out the words 'FLUX SCHNELL', tasty, food photography, dynamic shot"`
- **Best Practice:** Detailed, descriptive prompts yield better results
- **Recommendation:** Include style, mood, lighting, composition, and specific details

#### `aspect_ratio` (optional)
- **Type:** String
- **Default:** `"1:1"`
- **Options:** `1:1`, `16:9`, `21:9`, `3:2`, `2:3`, `4:5`, `5:4`, `3:4`, `4:3`, `9:16`, `9:21`
- **Description:** Aspect ratio for the generated image
- **Use Cases:**
  - `1:1`: General purpose, social media (Instagram)
  - `16:9`: Widescreen, desktop backgrounds
  - `9:16`: Mobile, vertical videos
  - `3:2`: Photography, traditional landscape

#### `num_outputs` (optional)
- **Type:** Integer
- **Range:** 1-4
- **Default:** 1
- **Description:** Number of images to generate in parallel
- **Cost Impact:** Cost multiplies by number of outputs
- **Performance:** All generated simultaneously (same latency)
- **Use Cases:** A/B testing, variations, batch processing

#### `num_inference_steps` (optional)
- **Type:** Integer
- **Range:** 1-4
- **Default:** 4
- **Recommendations:**
  - `4`: Recommended for best quality/speed balance
  - `3`: Good quality, faster
  - `2`: Decent quality, very fast
  - `1`: Fastest, lower quality
- **Notes:** Model trained for 1-4 steps only
- **Description:** Number of denoising diffusion steps

#### `seed` (optional)
- **Type:** Integer
- **Default:** Random (varies each run)
- **Range:** Any integer
- **Description:** Random seed for reproducible generation
- **Use Cases:**
  - Testing different prompts with same base seed
  - Reproducing exact images
  - Systematic variation

#### `output_format` (optional)
- **Type:** String
- **Default:** `"webp"`
- **Options:** `webp`, `jpg`, `png`
- **Description:** Format of the output images
- **Comparison:**
  - **WebP:** Best compression (recommended)
  - **JPG:** Broad compatibility, standard compression
  - **PNG:** Lossless, larger file size, maximum quality
- **Recommendation:** Use WebP for web, PNG for print

#### `output_quality` (optional)
- **Type:** Integer
- **Range:** 0-100
- **Default:** 80
- **Description:** Quality when saving output images
- **Recommendations:**
  - `80`: Default, good balance
  - `90-100`: Professional output, larger files
  - `50-70`: Quick iterations, smaller files
  - `0`: Minimum quality (not recommended)

#### `disable_safety_checker` (optional)
- **Type:** Boolean
- **Default:** `false`
- **Website Limitation:** Cannot be disabled when running on the website
- **API Limitation:** Some prompts may be blocked by safety checker
- **Description:** Disable safety checker for generated images
- **Note:** Safety filtering is applied by default

#### `go_fast` (optional)
- **Type:** Boolean
- **Default:** `true`
- **Description:** Run faster predictions with FP8 quantized model
- **Effect:** Enables quantization optimization
- **Trade-off:** Minimal quality loss for speed gain
- **Setting to false:** Runs in full precision (slower)
- **Recommendation:** Keep true for most use cases

#### `megapixels` (optional)
- **Type:** String
- **Default:** `"1"`
- **Options:** `"0.25"`, `"1"`
- **Description:** Approximate number of megapixels for generated image
- **Pixel Counts:**
  - `"0.25"`: ~500x500 at 1:1 aspect ratio (low resolution)
  - `"1"`: ~1024x1024 at 1:1 aspect ratio (standard)
- **Use Cases:**
  - `"0.25"`: Draft mode, quick testing
  - `"1"`: Standard production

## API Usage & Integration

### API Endpoints
- **Replicate API Base URL:** `https://api.replicate.com/v1`
- **Model Endpoint:** `https://api.replicate.com/v1/predictions`
- **Model Identifier:** `black-forest-labs/flux-schnell`

### Authentication
- **Method:** Bearer Token (HTTP Header)
- **Header:** `Authorization: Bearer $REPLICATE_API_TOKEN`
- **Token Format:** `r8_*` prefix
- **How to Get Token:**
  1. Create account at replicate.com
  2. Navigate to Account Settings > API Tokens
  3. Create new API token
  4. Store securely (never commit to version control)

### Environment Setup

**Set Token (macOS/Linux):**
```bash
export REPLICATE_API_TOKEN=r8_your_token_here
```

**Set Token (Windows PowerShell):**
```powershell
$env:REPLICATE_API_TOKEN='r8_your_token_here'
```

**Verify Token:**
```bash
echo $REPLICATE_API_TOKEN  # Should output your token
```

### Request/Response Format
- **Request Method:** POST
- **Content-Type:** application/json
- **Response Format:** JSON with prediction details

**Response includes:**
- Prediction ID
- Status (starting, processing, succeeded, failed)
- Created timestamp
- Completed timestamp
- Output array with image URLs
- Error messages (if failed)

## Code Examples

### Node.js - Quick Start (One-Liner)
```bash
npx create-replicate --model=black-forest-labs/flux-schnell
```

### Node.js - Full Example with All Parameters
```javascript
import Replicate from "replicate";
import { writeFile } from "fs/promises";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

async function generateImage() {
  try {
    const output = await replicate.run("black-forest-labs/flux-schnell", {
      input: {
        prompt: "black forest gateau cake spelling out the words \"FLUX SCHNELL\", tasty, food photography, dynamic shot",
        aspect_ratio: "1:1",
        num_outputs: 1,
        num_inference_steps: 4,
        go_fast: true,
        output_format: "webp",
        output_quality: 80,
        seed: 42, // Optional: for reproducibility
      },
    });

    // Output is an array of URLs
    console.log("Generated images:");
    output.forEach((url, index) => {
      console.log(`  ${index}: ${url}`);
    });

    // Download and save images
    for (const [index, url] of output.entries()) {
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      await writeFile(`output_${index}.webp`, Buffer.from(buffer));
      console.log(`Saved: output_${index}.webp`);
    }
  } catch (error) {
    console.error("Generation failed:", error);
  }
}

generateImage();
```

### Node.js - Streaming Example
```javascript
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

const prediction = await replicate.predictions.create({
  version: "black-forest-labs/flux-schnell",
  input: {
    prompt: "a serene landscape at sunset",
    num_inference_steps: 4,
  },
});

console.log("Prediction created:", prediction.id);

// Poll for completion
const completed = await replicate.wait(prediction);
console.log("Generation complete!");
console.log("Images:", completed.output);
```

### Python - Quick Start
```bash
pip install replicate
```

### Python - Full Example
```python
import replicate
import requests
from pathlib import Path

client = replicate.Replicate()

# Generate image
output = client.run(
    "black-forest-labs/flux-schnell",
    input={
        "prompt": "black forest gateau cake spelling out the words \"FLUX SCHNELL\", tasty, food photography, dynamic shot",
        "aspect_ratio": "1:1",
        "num_outputs": 1,
        "num_inference_steps": 4,
        "go_fast": True,
        "output_format": "webp",
        "output_quality": 80,
        "seed": 42,
    }
)

print("Generated images:")
for i, url in enumerate(output):
    print(f"  {i}: {url}")
    
    # Download images
    response = requests.get(url)
    Path(f"output_{i}.webp").write_bytes(response.content)
    print(f"Saved: output_{i}.webp")
```

### Python - Advanced Example with Error Handling
```python
import replicate
import asyncio
import aiohttp
from pathlib import Path

async def generate_and_save(prompt: str, num_outputs: int = 1):
    """Generate images and save them locally."""
    
    client = replicate.Replicate()
    
    try:
        output = client.run(
            "black-forest-labs/flux-schnell",
            input={
                "prompt": prompt,
                "num_outputs": min(num_outputs, 4),  # Max 4
                "num_inference_steps": 4,
                "go_fast": True,
                "output_format": "webp",
                "output_quality": 90,
            }
        )
        
        # Download images asynchronously
        async with aiohttp.ClientSession() as session:
            tasks = []
            for i, url in enumerate(output):
                task = download_image(session, url, f"output_{i}.webp")
                tasks.append(task)
            
            await asyncio.gather(*tasks)
        
        print(f"Successfully generated and saved {len(output)} image(s)")
        
    except Exception as e:
        print(f"Error: {e}")

async def download_image(session, url: str, filename: str):
    """Download image from URL."""
    async with session.get(url) as resp:
        if resp.status == 200:
            content = await resp.read()
            Path(filename).write_bytes(content)
            print(f"Saved: {filename}")
        else:
            print(f"Failed to download {url}: {resp.status}")

# Usage
asyncio.run(generate_and_save("a beautiful sunset over mountains", num_outputs=2))
```

### cURL - Basic Request
```bash
curl -X POST https://api.replicate.com/v1/predictions \
  -H "Authorization: Bearer $REPLICATE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "black-forest-labs/flux-schnell",
    "input": {
      "prompt": "black forest gateau cake spelling out the words \"FLUX SCHNELL\", tasty, food photography, dynamic shot",
      "aspect_ratio": "1:1",
      "num_inference_steps": 4,
      "go_fast": true
    }
  }'
```

### cURL - Full Example with Polling
```bash
#!/bin/bash

# Create prediction
RESPONSE=$(curl -s -X POST https://api.replicate.com/v1/predictions \
  -H "Authorization: Bearer $REPLICATE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "black-forest-labs/flux-schnell",
    "input": {
      "prompt": "a serene landscape at sunset",
      "num_inference_steps": 4
    }
  }')

# Extract prediction ID
PREDICTION_ID=$(echo $RESPONSE | jq -r '.id')
echo "Prediction ID: $PREDICTION_ID"

# Poll for completion
while true; do
  STATUS=$(curl -s -H "Authorization: Bearer $REPLICATE_API_TOKEN" \
    "https://api.replicate.com/v1/predictions/$PREDICTION_ID" | jq -r '.status')
  
  echo "Status: $STATUS"
  
  if [ "$STATUS" = "succeeded" ]; then
    IMAGES=$(curl -s -H "Authorization: Bearer $REPLICATE_API_TOKEN" \
      "https://api.replicate.com/v1/predictions/$PREDICTION_ID" | jq -r '.output[]')
    echo "Generated images:"
    echo "$IMAGES"
    break
  elif [ "$STATUS" = "failed" ]; then
    echo "Generation failed!"
    break
  fi
  
  sleep 1
done
```

### TypeScript - Type-Safe Example
```typescript
import Replicate from "replicate";

interface FluxInput {
  prompt: string;
  aspect_ratio?: "1:1" | "16:9" | "21:9" | "3:2" | "2:3" | "4:5" | "5:4" | "3:4" | "4:3" | "9:16" | "9:21";
  num_outputs?: number;
  num_inference_steps?: number;
  seed?: number;
  output_format?: "webp" | "jpg" | "png";
  output_quality?: number;
  go_fast?: boolean;
  disable_safety_checker?: boolean;
}

async function generateFluxImage(input: FluxInput): Promise<string[]> {
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });

  const output = await replicate.run("black-forest-labs/flux-schnell", {
    input: {
      prompt: input.prompt,
      aspect_ratio: input.aspect_ratio || "1:1",
      num_outputs: input.num_outputs || 1,
      num_inference_steps: input.num_inference_steps || 4,
      go_fast: input.go_fast !== false,
      output_format: input.output_format || "webp",
      output_quality: input.output_quality || 80,
      ...(input.seed && { seed: input.seed }),
    },
  });

  return output as string[];
}

// Usage
const images = await generateFluxImage({
  prompt: "a cyberpunk city at night",
  num_outputs: 2,
  aspect_ratio: "16:9",
});

console.log("Generated images:", images);
```

## Examples & Use Cases

### Example 1: High-Quality Portrait

**Prompt:**
```
A professional portrait of a woman in her 30s with warm lighting, soft focus background, shot on a 50mm lens, fashion photography style, high detail, studio lighting
```

**Recommended Settings:**
- `num_inference_steps`: 4 (default)
- `output_quality`: 90
- `aspect_ratio`: 3:4 (portrait)
- `output_format`: png (for lossless quality)

**Generated in:** 0.83 seconds  
**Cost:** $0.003

### Example 2: Product Photography

**Prompt:**
```
A sleek Apple iPhone 15 Pro on a marble table with soft window lighting, professional product photography, shallow depth of field, luxury magazine style photography
```

**Recommended Settings:**
- `num_inference_steps`: 4
- `output_quality`: 95
- `aspect_ratio`: 1:1 (square for e-commerce)
- `num_outputs`: 2 (get variations)

**Generated in:** 1.66 seconds (for 2 images)  
**Cost:** $0.006

### Example 3: Landscape Concept Art

**Prompt:**
```
Dramatic mountain landscape at sunrise, epic cinematic composition, golden hour light, misty valleys, fantasy art style, vibrant colors, matte painting quality, depth and scale
```

**Recommended Settings:**
- `num_inference_steps`: 4
- `output_quality`: 85
- `aspect_ratio`: 16:9 (widescreen)
- `output_format`: webp

**Generated in:** 0.83 seconds  
**Cost:** $0.003

### Example 4: UI/UX Mockup

**Prompt:**
```
Clean modern app interface for a fitness tracking application, minimalist design, bright colors, iOS style, professional design, high contrast, mobile interface mockup
```

**Recommended Settings:**
- `num_inference_steps`: 4
- `output_quality`: 80
- `aspect_ratio`: 9:16 (mobile)
- `num_outputs`: 3 (variations)

**Generated in:** 2.49 seconds (for 3 images)  
**Cost:** $0.009

### Example 5: Food Photography

**Prompt:**
```
A beautifully plated gourmet dish - seared scallops with microgreens and colorful sauce on a white plate, soft natural lighting, macro photography, professional food photography, fine dining presentation
```

**Recommended Settings:**
- `num_inference_steps`: 4
- `output_quality`: 90
- `aspect_ratio`: 4:5
- `output_format`: png

**Generated in:** 0.83 seconds  
**Cost:** $0.003

### Example 6: Character Design

**Prompt:**
```
A fantasy character - elf ranger with pointed ears, leather armor, holding a bow, dynamic pose, magical aura around her, fantasy art style, character sheet illustration, detailed costume design
```

**Recommended Settings:**
- `num_inference_steps`: 4
- `output_quality`: 85
- `aspect_ratio`: 3:4 (portrait)
- `num_outputs`: 2 (get variations)

**Generated in:** 1.66 seconds (for 2)  
**Cost:** $0.006

### Example 7: Interior Design

**Prompt:**
```
Modern minimalist living room with concrete walls, large windows with natural light, mid-century modern furniture, warm tones, plants, cozy atmosphere, interior design photography, realistic rendering
```

**Recommended Settings:**
- `num_inference_steps`: 4
- `output_quality`: 85
- `aspect_ratio`: 16:9
- `num_outputs`: 2

**Generated in:** 1.66 seconds  
**Cost:** $0.006

## Implementation & Repositories

### Official GitHub Repository (Black Forest Labs)
- **URL:** https://github.com/black-forest-labs/flux
- **Contents:**
  - Reference implementation of FLUX.1 [schnell]
  - Sampling code and usage examples
  - Model architecture details
  - License information
  - Research documentation

### Replicate Cog Implementation
- **URL:** https://github.com/replicate/cog-flux
- **Purpose:** Cog inference wrapper for FLUX models on Replicate
- **Contents:**
  - Model inference code optimized for Replicate
  - API parameter handling
  - Integration code
  - Documentation

### Model Weights
- **URL:** https://huggingface.co/black-forest-labs/FLUX.1-schnell
- **Provider:** Hugging Face Model Hub
- **Format:** Diffusers-compatible weights
- **Size:** Approximately 23 GB
- **Use Cases:**
  - Local inference
  - Fine-tuning
  - Custom integration
  - Research

### ComfyUI Support
- **URL:** https://github.com/comfyanonymous/ComfyUI
- **Compatibility:** FLUX.1 [schnell] available as node
- **Interface:** Node-based visual workflow
- **Use Cases:**
  - Local inference without coding
  - Advanced compositing workflows
  - Integration with other AI tools

## Performance Characteristics

### Speed Performance

| Metric | Value |
|--------|-------|
| **Typical Generation Time** | 0.83 seconds |
| **Time for 2 Images** | ~1.66 seconds |
| **Time for 3 Images** | ~2.49 seconds |
| **Time for 4 Images** | ~3.32 seconds |
| **Cold Start** | None (warm/always-on) |
| **Inference Steps** | 1-4 (4 recommended) |

### Quality Performance

- **Prompt Adherence:** Excellent (matches closed-source models)
- **Detail Level:** High-quality fine details despite minimal steps
- **Consistency:** Good seed reproducibility
- **Color Accuracy:** Excellent color rendering
- **Composition:** Good spatial composition

### Scalability Metrics

- **Parallel Outputs:** Up to 4 simultaneously
- **Total Runs:** 592.7M (industry-leading adoption)
- **Infrastructure:** Replicate's fully managed cloud
- **Availability:** 99.9%+ uptime SLA
- **Throughput:** Capable of handling millions of requests

## Limitations

### Acknowledged Limitations

1. **Not Intended for Factual Information**
   - Model is not designed to provide accurate factual data
   - Not suitable for information retrieval or educational accuracy
   - May hallucinate or create inaccurate details
   - Should not be used for content requiring factual correctness

2. **Potential for Societal Bias Amplification**
   - As a statistical model trained on internet data, may amplify existing biases
   - May produce stereotypical or biased representations
   - Outputs should be reviewed for bias in critical applications
   - Results may reflect training data limitations and demographics

3. **Prompt-Following Variability**
   - May fail to generate output exactly matching prompts
   - Quality varies based on prompt clarity and complexity
   - Prompt following heavily influenced by prompting style and specificity
   - Detailed, well-structured prompts typically yield better results
   - Ambiguous prompts may produce unexpected results

4. **Generation Failures**
   - Model may occasionally fail to generate valid output
   - Safety checker may reject certain prompts
   - Quality varies based on prompt content type
   - Complex or unusual requests may fail

5. **Consistency Limitations**
   - Different seeds produce different results even with same prompt
   - No guarantee of exact reproduction across API versions
   - Minor changes in parameters may affect output

### Technical Limitations

- **Maximum Outputs:** 4 images per request
- **Inference Steps:** Only supports 1-4 steps
- **Resolution:** Limited by megapixels parameter
- **Processing Time:** Scales linearly with number of outputs
- **Safety Filtering:** Some prompts automatically blocked

## Prohibited Use Cases (Out-of-Scope)

The model and its derivatives may NOT be used for:

### 1. **Illegal Activity**
- Violating national, federal, state, local, or international law
- Facilitating unlawful conduct
- Breaking any applicable regulations
- Creating content for illegal purposes

### 2. **Harm to Minors**
- Exploiting, harming, or attempting to harm minors in any way
- Sexual content involving minors (any age)
- Child endangerment or abuse material
- Content that endangers children's safety or wellbeing

### 3. **Misinformation & Disinformation**
- Generating or disseminating verifiably false information
- Content intended to cause harm through deception
- False impersonation or identity fraud
- Deepfakes used for deception (unless clearly labeled)

### 4. **Privacy Violations**
- Generating or disseminating personally identifiable information (PII)
- Content that could be used to harm individuals
- Privacy breaches or invasion of privacy
- Unauthorized use of real people's likenesses

### 5. **Harassment & Violence**
- Harassing, abusing, threatening, stalking, or bullying individuals/groups
- Incitement to violence or harm
- Hate speech or discriminatory content
- Content promoting violence against any group

### 6. **Non-Consensual Content**
- Creating non-consensual nudity
- Deepfake pornography without consent
- Illegal pornographic content
- Sexual content without consent of all parties depicted

### 7. **Autonomous Decision-Making**
- Fully automated decision making with legal consequences
- Systems that impact individual rights without human review
- Automated hiring/firing decisions
- Legal determinations without human oversight

### 8. **Disinformation Campaigns**
- Generating or facilitating large-scale disinformation
- Coordinated manipulation campaigns
- Election interference or manipulation
- Mass production of false information

## Training & Fine-Tuning

### Fine-Tuning Support
- **Availability:** FLUX.1 [schnell] supports fine-tuning
- **Purpose:** Adapt model to specific domains or styles
- **Documentation:** https://replicate.com/blog/fine-tune-flux
- **Use Cases:**
  - Brand-specific image generation
  - Art style consistency
  - Domain-specific content
  - Custom visual language

### Fine-Tuning Blog Post
- **URL:** http://replicate.com/blog/fine-tune-flux
- **Contents:**
  - Complete fine-tuning guide
  - Best practices for custom models
  - Dataset preparation
  - Training parameters
  - Cost and time estimates

### Training Data
- Trained on high-quality, diverse image-text pairs
- Distilled from larger base models using ADD method
- Optimized for fast inference without significant quality loss
- Represents broad visual concepts and styles

## Related FLUX Models

### FLUX.1 Model Variants on Replicate

| Model | Speed | Quality | Use Case | Cost |
|-------|-------|---------|----------|------|
| **flux-schnell** | 0.83s ⚡⚡⚡ | High | Fast production | $0.003/img |
| **flux-dev** | ~8s | Very High | Development, features | Higher |
| **flux-1.1-pro** | ~10s | Ultra High | Professional production | Higher |
| **flux-1.1-pro-ultra** | ~15s | Maximum | Quality over speed | Higher |
| **flux-kontext-pro** | ~10s | High | Text-based editing | Higher |
| **flux-kontext-max** | ~15s | Ultra High | Professional editing | Higher |

### Fastest Alternatives (Non-FLUX)

| Model | Speed | Quality | Cost | Best For |
|-------|-------|---------|------|----------|
| **flux-schnell** | 0.83s | High | $0.003 | Best overall |
| **prunaai/p-image** | <1s | Good | $0.005 | Sub-second |
| **z-image-turbo** | 1.4s | Excellent | $0.0025-0.01 | Text rendering |
| **imagen-4-fast** | 2.9s | Good | $0.02 | Budget option |
| **ideogram-v3-turbo** | 6.1s | Excellent | $0.03 | Design work |

## External Resources

### Official Documentation & Links

**Black Forest Labs Official:**
- Announcement: https://blackforestlabs.ai/announcing-black-forest-labs/
- License: https://github.com/black-forest-labs/flux/blob/main/model_licenses/LICENSE-FLUX1-schnell
- GitHub: https://github.com/black-forest-labs/flux
- Model Weights: https://huggingface.co/black-forest-labs/FLUX.1-schnell

**Replicate Official:**
- Model Page: https://replicate.com/black-forest-labs/flux-schnell
- Playground: https://replicate.com/black-forest-labs/flux-schnell
- API Documentation: https://replicate.com/black-forest-labs/flux-schnell/api
- Examples: https://replicate.com/black-forest-labs/flux-schnell/examples
- README: https://replicate.com/black-forest-labs/flux-schnell/readme
- Fine-Tuning Guide: http://replicate.com/blog/fine-tune-flux
- Billing Docs: https://replicate.com/docs/billing
- Model Status: https://replicatestatus.com

**Developer Tools:**
- ComfyUI: https://github.com/comfyanonymous/ComfyUI
- Replicate Node.js: https://github.com/replicate/replicate-javascript
- Replicate Python: https://github.com/replicate/replicate-python
- Replicate Docs: https://replicate.com/docs

### API Schema & Reference
- **Schema Details:** https://replicate.com/black-forest-labs/flux-schnell/api/schema
- **API Reference:** https://replicate.com/black-forest-labs/flux-schnell/api/api-reference
- **Learn More:** https://replicate.com/black-forest-labs/flux-schnell/api/learn-more

## Practical Tips

### For Best Results

#### 1. **Prompt Techniques**
- **Use Detailed Descriptions:** "A woman" → "A woman in her 30s with warm lighting, soft focus background"
- **Include Style Keywords:** photorealistic, oil painting, digital art, cinematic, watercolor
- **Mention Lighting:** golden hour, studio lighting, soft natural light, dramatic shadows
- **Specify Camera Details:** 50mm lens, shallow depth of field, wide angle, macro
- **Add Mood/Atmosphere:** moody, vibrant, serene, energetic, mysterious
- **Example:** "A serene landscape at sunset, golden hour light, mountain peaks, mist in valleys, vibrant orange and purple sky, matte painting quality, epic composition"

#### 2. **Inference Steps Strategy**
- **4 steps (default):** Recommended for best quality/speed balance
- **3 steps:** Still good quality, slightly faster
- **2 steps:** Decent quality, noticeably faster, good for drafting
- **1 step:** Fastest but lowest quality, use for rapid prototyping only

#### 3. **Aspect Ratio Selection**
| Aspect Ratio | Use Case | Examples |
|--------------|----------|----------|
| **1:1** | General purpose, social media, square layouts | Instagram, Twitter, Product images |
| **16:9** | Widescreen, cinematic, desktop backgrounds | Movies, YouTube, Desktop |
| **9:16** | Mobile, vertical video, portraits | TikTok, Instagram Stories, Mobile apps |
| **3:2** | Photography, landscape | Professional photos |
| **4:5** | Portrait, Fashion | Instagram posts, Fashion |
| **21:9** | Ultrawide, panoramic | Gaming, Ultra-wide monitors |

#### 4. **Output Quality Settings**
- **80 (default):** Good balance for most uses
- **90-100:** Professional, print-quality, archival
- **70:** Acceptable for web use, smaller files
- **50-60:** Quick iterations, draft mode
- **Below 50:** Not recommended

#### 5. **Batch Generation Strategy**
```
For A/B Testing:
- Generate 2-4 variations of same prompt
- Compare and choose best
- Cost: ~$0.006-0.012

For Rapid Iteration:
- Generate 1 at lowest quality to test prompt
- Refine prompt
- Generate final at high quality
- Total cost: ~$0.006 per cycle
```

#### 6. **Seed Usage for Reproducibility**
```javascript
// First generation with seed
const output1 = await replicate.run("black-forest-labs/flux-schnell", {
  input: {
    prompt: "a beautiful landscape",
    seed: 42,
  }
});

// Same prompt, same seed = identical image
const output2 = await replicate.run("black-forest-labs/flux-schnell", {
  input: {
    prompt: "a beautiful landscape",
    seed: 42,
  }
});

// Same seed, different prompt = similar style
const output3 = await replicate.run("black-forest-labs/flux-schnell", {
  input: {
    prompt: "a different landscape",
    seed: 42, // Similar composition/lighting
  }
});
```

### API Best Practices

#### 1. **Error Handling**
```python
import replicate
import time

def generate_with_retry(prompt, max_retries=3):
    for attempt in range(max_retries):
        try:
            output = replicate.run(
                "black-forest-labs/flux-schnell",
                input={"prompt": prompt}
            )
            return output
        except replicate.ReplicateError as e:
            if attempt < max_retries - 1:
                print(f"Attempt {attempt + 1} failed, retrying...")
                time.sleep(2 ** attempt)  # Exponential backoff
            else:
                raise
```

#### 2. **Cost Optimization**
- Generate multiple images in parallel (num_outputs: 2-4)
- Use WebP format for smaller file sizes
- Cache results for repeated prompts
- Use lower quality for drafts
- Batch process requests during off-peak hours

#### 3. **Production Deployment**
```python
# Use async for high-volume generation
import asyncio
import replicate

async def batch_generate(prompts: list, max_concurrent=5):
    """Generate multiple images with rate limiting."""
    semaphore = asyncio.Semaphore(max_concurrent)
    
    async def generate_one(prompt):
        async with semaphore:
            return await replicate.async_run(
                "black-forest-labs/flux-schnell",
                input={"prompt": prompt}
            )
    
    tasks = [generate_one(prompt) for prompt in prompts]
    return await asyncio.gather(*tasks)

# Usage
results = asyncio.run(batch_generate([
    "a beautiful sunset",
    "a mountain landscape",
    "an urban scene"
]))
```

#### 4. **Monitoring & Logging**
```python
import logging
import replicate

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def generate_with_logging(prompt):
    logger.info(f"Starting generation: {prompt}")
    start = time.time()
    
    try:
        output = replicate.run(
            "black-forest-labs/flux-schnell",
            input={"prompt": prompt}
        )
        duration = time.time() - start
        logger.info(f"Generated in {duration:.2f}s: {output}")
        return output
    except Exception as e:
        logger.error(f"Generation failed: {e}", exc_info=True)
        raise
```

## Status & Support

### Model Status
- **Current Status:** Official, Always-On
- **Availability:** 99.9%+ uptime SLA
- **Support Level:** Full production support
- **Updates:** Regular maintenance and improvements
- **Last Updated:** June 25, 2025

### Support Channels
- **Email:** support@replicate.com
- **Status Page:** https://replicatestatus.com
- **Documentation:** https://replicate.com/docs
- **GitHub Issues:** https://github.com/black-forest-labs/flux/issues

### Version History
- **v1 Released:** July 30, 2024
