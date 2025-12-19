# GLiNER TypeScript Migration Summary

## What Changed

### Updated `NlpSpanService.ts`
Full TypeScript rewrite using the official `gliner` npm package directly:
- Reduced from ~600 lines to ~300 lines
- Removed custom RobustGLiNER implementation
- Direct import from `gliner` package - no wrapper needed
- Clean separation: Aho-Corasick → GLiNER → merge/dedupe

## Setup Steps

### Step 1: Install the gliner package
```bash
npm install gliner
```

### Step 2: Download the ONNX model

```bash
mkdir -p server/src/llm/span-labeling/nlp/models

# Download from HuggingFace
# Visit: https://huggingface.co/onnx-community/gliner_small-v2.1/tree/main/onnx
# Download model.onnx to server/src/llm/span-labeling/nlp/models/

# Or via CLI:
cd server/src/llm/span-labeling/nlp/models
wget https://huggingface.co/onnx-community/gliner_small-v2.1/resolve/main/onnx/model.onnx
```

### Step 3: Enable GLiNER in config

Edit `server/src/llm/span-labeling/config/SpanLabelingConfig.ts`:

```typescript
export const NEURO_SYMBOLIC = {
  ENABLED: true,
  
  GLINER: {
    ENABLED: true,  // Enable GLiNER
    MODEL_PATH: 'onnx-community/gliner_small-v2.1',
    THRESHOLD: 0.3,
    MAX_WIDTH: 12,
  },
};
```

### Step 4: Test
```bash
npm run server
```

## Architecture

```
Text Input
    ▼
┌────────────────────────────┐
│ Tier 1: Aho-Corasick       │  <1ms
│ 281 technical terms        │  100% precision
└────────────────────────────┘
    ▼
┌────────────────────────────┐
│ Tier 2: GLiNER (optional)  │  ~100-200ms
│ Open vocabulary NER        │  Zero-shot
└────────────────────────────┘
    ▼
┌────────────────────────────┐
│ Tier 3: LLM (fallback)     │  ~500-2000ms
│ Complex reasoning          │
└────────────────────────────┘
```

## Potential Issues

### gliner package uses onnxruntime-web
The package is browser-focused but works in Node.js via WASM. If you hit issues:
1. Stick with Aho-Corasick + LLM only
2. Use a Python sidecar for GLiNER
3. Fix the original onnxruntime-node implementation

## Files Changed

- `server/src/llm/span-labeling/nlp/NlpSpanService.ts` - REWRITTEN
