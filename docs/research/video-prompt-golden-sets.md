# Video Prompt Golden Sets: What Exists Publicly (and What Doesn’t)

## What You Can Benchmark Against Publicly

There is **no widely adopted “golden set” of long, cinematic, model-ready prompts** (e.g., 75–125 word paragraphs + explicit technical specs) that is standardized across Sora/Runway/Veo/Kling/Luma. What *does* exist publicly falls into two useful buckets:

### 1) Prompt Suites for Evaluating Video *Models* (curated, but usually short)

- **VBench prompt suite** (CVPR 2024): curated prompts per evaluation dimension and content category.  
  Repo: `https://github.com/Vchitect/VBench` (see `prompts/`)

- **T2V-CompBench prompt suite** (2024): 700 compositional prompts across 7 categories (attribute binding, spatial relationships, interactions, numeracy, etc.).  
  Repo: `https://github.com/KaiyueSun98/T2V-CompBench` (see `prompts/`)

These are great for **coverage** and **stress testing**, but the prompts are generally “caption-like” rather than “director’s treatment” prose.

### 2) Real-World Prompt Corpora (large, messy, realistic)

- **VidProM** (NeurIPS 2024): 1.67M unique text-to-video prompts + associated generations from multiple diffusion T2V models.  
  Repo: `https://github.com/WangWenhao0716/VidProM`  
  Dataset: `https://huggingface.co/datasets/WenhaoWang/VidProM`

VidProM is useful for **distribution realism** (what users actually type), including aspect ratio / FPS tokens and inconsistent formatting.

### 3) Community Prompt Collections (small, subjective “best of”)

- “Awesome video prompts” style repos exist (e.g., `https://github.com/khanof89/awesome-video-prompts`), but they’re not standardized and are closer to **templates/examples** than benchmarks.

## How to Use These in This Repo

Given PromptCanvas’ architecture, you likely need **two different prompt corpora**:

1. **Span Labeling Golden Set (Production-Format)**  
   - Use *your own optimized output format* (main paragraph + `**TECHNICAL SPECS**` + optional variations).  
   - Seed it by optimizing prompts sampled from **VidProM**, **VBench**, and **T2V-CompBench**, then **human-annotate spans** using your taxonomy.

2. **Span Labeling Golden Set (Raw User Inputs)**  
   - Short, messy prompts (including emojis, multiple languages, “-ar 16:9”, etc.).  
   - VidProM is a strong source for this distribution.

This avoids mixing domains and lets you track performance where it matters (optimized outputs) without losing robustness coverage (raw inputs).

