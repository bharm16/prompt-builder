# Text-to-Video Prompting: Gap Analysis & Improvement Opportunities

> **Date:** December 2024
> **Status:** Research Complete
> **Sources:** OpenAI Sora 2 Guide, Runway Gen-4 Documentation, Industry Best Practices

---

## Executive Summary

Our system implements many foundational best practices (one-action rule, cinematic terminology, visual-only descriptions). However, the 2025 generation of AI video models (Sora 2, Runway Gen-4.5, Kling 2.6, Veo 3) has evolved significantly—they're now **physics simulators** rather than just visual generators. This creates several opportunities to enhance our workflow.

---

## Current Strengths

| Practice | Our Implementation | Evidence |
|----------|---------------------|----------|
| **One Action Rule** | Strongly enforced | `videoPromptLinter.ts:140-162` - detects multiple actions, "and" sequences, comma lists |
| **Specificity > Generic** | Core principle | `videoPromptTemplates.ts:343-347` - "weathered oak desk" vs "nice desk" |
| **Visual Precedence** | Linter enforces | Viewer/audience language detection blocks non-camera-visible descriptions |
| **Avoid "Cinematic"** | Actively blocked | `videoPromptLinter.ts:16-21` - Generic style language detection |
| **Film Stock References** | Encouraged | Style element examples include "shot on 35mm film", "documentary verité" |
| **Duration Awareness** | Documented | 4-8 second clip optimization mentioned in principles |
| **Structured Elements** | 10-element system | Subject, descriptors, action, location, time, mood, style, event |

---

## Critical Gaps vs. 2025 Best Practices

### 1. Missing Physics/Forces Vocabulary (Highest Impact)

**The Problem:** Modern models like Runway Gen-4.5 and Sora 2 are physics simulators. Describing appearances alone produces "floaty" results.

**Current approach:**
```
"car driving down city street" → describes appearance
```

**2025 best practice:**
```
"sedan with visible weight transfer on suspension, tires gripping wet asphalt,
momentum carrying into the turn, brake lights illuminating raindrops in turbulent wake"
→ describes forces and physics
```

**Evidence:** Runway's official guide states: *"Stop describing what things look like. Start describing the forces acting on them."*

**Recommendation:** Add a **physics vocabulary layer** to templates:
- Material properties: "wet nylon", "heavy velvet", "brittle glass"
- Forces: "8–10 mph crosswind", "gravity pulling", "resistance of water"
- Physical effects: "momentum carrying", "weight transfer", "inertia"

---

### 2. No Camera Movement Element

**The Problem:** Our system has `shot_framing` and `camera_angle` but **no dynamic camera movement field**.

**Current elements in `videoPromptLinter.ts`:**
```typescript
'shot_framing',    // Wide Shot, Close-Up
'camera_angle',    // Low-Angle, Bird's-Eye
// ❌ Missing: camera_move
```

**2025 best practice:** Camera movement is a first-class element:
- **Tracking** (moving parallel to subject)
- **Dolly** (toward/away from subject)
- **Crane** (vertical movement with horizontal)
- **Handheld** (natural shake)
- **Whip pan** (fast horizontal)
- **Rack focus** (shifting focal plane)

**Recommendation:** Add a `camera_movement` element with examples like:
- "slow dolly in with rack focus to face"
- "handheld following subject through crowd"
- "crane up revealing city skyline"

---

### 3. No Temporal/Storyboard Structure

**The Problem:** Prompts describe a static moment, not a temporal progression.

**Current approach:**
```
Subject + Action + Location + Time + Mood + Style
→ Describes ONE moment
```

**2025 best practice (from OpenAI's official Sora 2 guide):**
```
"At 0s: the hero steps forward into frame;
At 3s: camera pans left revealing the city;
At 6s: she turns to face the skyline, wind catching her hair"
→ Storyboard with temporal markers
```

**Recommendation:** Add optional **beat markers** or **progression phases**:
```typescript
{
  opening_beat: "hero visible in silhouette",
  mid_beat: "camera reveals full figure as she turns",
  closing_beat: "wind catches coat as city lights flicker on"
}
```

---

### 4. No Platform-Specific Output Modes

**The Problem:** Different platforms interpret prompts differently:

| Platform | Best For | Prompting Style |
|----------|----------|-----------------|
| **Sora 2** | Physics simulation | Causal chains, shot lists |
| **Runway Gen-4.5** | Forces & motion | Physics vocabulary, force descriptions |
| **Kling 2.6** | Audio-visual sync | Timeline scripts with beat markers |
| **Pika** | Quick iterations | Short, specific prompts |
| **Veo 3** | Narration | Dialogue blocks, voiceover |

**Recommendation:** Add a `targetPlatform` option that adjusts:
- Prompt structure/ordering
- Vocabulary emphasis
- Length constraints
- Audio/visual separation

---

### 5. No Image Reference Workflow

**The Problem:** OpenAI's guide emphasizes using image generation to create visual references that provide consistency across shots.

**2025 best practice:**
> *"If you don't already have visual references, OpenAI's image generation model is a powerful way to create them. You can quickly produce environments and scene designs and then pass them into Sora as references."*

**Recommendation:** Add an optional `reference_image` workflow:
1. Generate style frames from text
2. Use these as anchors for video generation
3. Store reference IDs for multi-shot consistency

---

### 6. No Audio/Sound Specification

**The Problem:** Kling 2.6 and Veo 3.1 generate audio alongside video. Our system has no audio elements.

**2025 best practice for Kling:**
```
Negative audio prompt: "No background music, no mumble, no overlapping speech, no distortion"
Positive audio prompt: "Crisp footsteps on concrete, distant city traffic, wind through alley"
```

**Recommendation:** Add optional audio elements:
```typescript
{
  ambient_sound: "rain on metal roof, distant thunder",
  audio_negative: "no music, no voice",
  sound_sync: "footsteps match walking rhythm"
}
```

---

### 7. Limited Material/Texture Vocabulary

**The Problem:** Examples emphasize visual details but rarely encode **material physics**.

**Current examples in `elementConfig.ts`:**
```typescript
'elderly street musician with weathered hands'  // ✓ Good texture
'matte black DJI drone with amber LEDs'        // ✓ Surface finish
'bengal cat with spotted coat'                  // ⚠️ Could add fur physics
```

**2025 best practice:**
> *"Encode materials and forces explicitly: 'wet nylon jacket,' '8–10 mph crosswind from camera left,' 'footfalls splashing in shallow puddles.'"*

**Recommendation:** Enhance subject descriptors with material properties:
- Fabric: "heavy velvet absorbing light", "sheer silk catching wind"
- Metal: "brushed aluminum reflecting cold light", "oxidized copper with green patina"
- Organic: "fur rippling with movement", "leaves with visible veins catching dew"

---

### 8. No Negative Prompt Support

**The Problem:** Modern platforms support negative prompts to exclude unwanted elements.

**2025 best practice for Kling:**
> *"Use negative prompts aggressively—e.g., 'No background music, no mumble, no overlapping speech, no distortion.'"*

**Recommendation:** Add optional negative prompt fields:
```typescript
{
  avoid_visual: "lens flare, motion blur, oversaturation",
  avoid_motion: "jittery movement, floating physics",
  avoid_audio: "background music, echo, distortion"
}
```

---

### 9. No Multi-Clip Storyboarding

**The Problem:** The official Sora 2 guide notes:
> *"You may see better results by stitching together two 4-second clips instead of generating a single 8-second clip."*

**Recommendation:** Add a **shot sequence** workflow:
1. Break concepts into 3-5 second shots
2. Maintain subject consistency across shots
3. Define transitions between shots
4. Export as a shot list with individual prompts

---

### 10. Missing Dialogue/Voiceover Formatting

**The Problem:** For platforms like Veo 3 that support narration, dialogue needs special formatting.

**2025 best practice:**
> *"Dialogue must be described directly in your prompt. Place it in a block below your prose description so the model clearly distinguishes visual description from spoken lines."*

**Recommendation:** Add optional dialogue element:
```typescript
{
  dialogue: {
    speaker: "narrator",
    line: "The city never sleeps...",
    delivery: "hushed, contemplative"
  }
}
```

---

## Priority Improvement Matrix

| Gap | Impact | Effort | Priority |
|-----|--------|--------|----------|
| Physics/Forces Vocabulary | High | Medium | **P0** |
| Camera Movement Element | High | Low | **P0** |
| Temporal Structure | Medium | Medium | **P1** |
| Platform-Specific Modes | Medium | High | **P1** |
| Material Texture Vocabulary | Medium | Low | **P1** |
| Negative Prompt Support | Medium | Low | **P2** |
| Audio Specification | Low | Medium | **P2** |
| Image Reference Workflow | Low | High | **P3** |
| Multi-Clip Storyboarding | Low | High | **P3** |
| Dialogue Formatting | Low | Low | **P3** |

---

## Recommended Implementation Path

### Phase 1: Quick Wins (Low Effort, High Impact)
1. **Add `camera_movement` element** to our 10-element system
2. **Enhance template examples** with physics vocabulary
3. **Add material properties** to subject descriptor guidance

### Phase 2: Core Enhancements
4. **Create physics vocabulary guide** as a reference for AI suggestions
5. **Add optional temporal beat structure** (opening → mid → closing)
6. **Implement negative prompt fields** for visual/motion/audio

### Phase 3: Advanced Features
7. **Platform-specific export modes** (Sora, Runway, Kling, Pika)
8. **Multi-shot storyboarding workflow**
9. **Audio specification system** for Kling/Veo

---

## Sources

- [OpenAI Sora 2 Prompting Guide](https://cookbook.openai.com/examples/sora/sora2_prompting_guide) - Official OpenAI Cookbook
- [Runway Gen-4 Video Prompting Guide](https://help.runwayml.com/hc/en-us/articles/39789879462419-Gen-4-Video-Prompting-Guide) - Official Runway documentation
- [How to Actually Control Next-Gen Video AI](https://medium.com/@creativeaininja/how-to-actually-control-next-gen-video-ai-runway-kling-veo-and-sora-prompting-strategies-92ef0055658b) - Platform comparison strategies
- [Awesome AI Video Prompts](https://github.com/geekjourneyx/awesome-ai-video-prompts) - Curated prompt resources
- [Sora 2 Prompting Best Practices](https://www.weshop.ai/blog/sora-2-prompting-best-practices-for-real-life-motion/) - Motion-focused guidance
