# Category Color System

## Overview

This document describes the color system used for categorizing and highlighting spans in the prompt builder. Each category has a unique color that reflects its semantic meaning and visual hierarchy.

---

## Color Palette

| Category | Color Name | Background Hex | Border Hex | Reasoning |
|----------|-----------|---------------|------------|-----------|
| **SUBJECT** | Warm Coral | `#FFF7ED` | `#EA580C` | The protagonist. Warm, human, draws focus. Orange = main character energy. |
| **ACTION** | Red-Orange | `#FEF2F2` | `#DC2626` | Movement, verbs, energy. Red = action, urgency. Close to Subject (they're paired). |
| **ENVIRONMENT** | Forest Green | `#F0FDF4` | `#16A34A` | Nature, location, grounding. Green is universally "place/nature." Keep this. |
| **LIGHTING** | Golden Amber | `#FFFBEB` | `#D97706` | Light itself. Yellow/gold is the only sensible choice. Keep this. |
| **SHOT** | Sky Blue | `#F0F9FF` | `#0284C7` | Frame/POV - the window through which we see. Blue = expansive, perspective. |
| **CAMERA** | Slate Gray | `#F8FAFC` | `#64748B` | Equipment/mechanics. Neutral, technical. Doesn't compete for attention. |
| **STYLE** | Violet | `#FAF5FF` | `#9333EA` | Creative/aesthetic. Purple = artistry, mood, flair. Keep this. |
| **TECHNICAL** | Cool Gray | `#F9FAFB` | `#6B7280` | Specs/metadata. Lowest visual priority. Gray = "supporting info." |
| **AUDIO** | Deep Indigo | `#EEF2FF` | `#4F46E5` | Sound waves, depth. Indigo = frequency, depth. Keep this. |

---

## Visual Hierarchy (by prominence)

1. **Subject** (coral) - What you're filming. Always most important.
2. **Action** (red) - What it's doing. Paired with Subject.
3. **Environment** (green) - Where it is. Grounding.
4. **Lighting** (amber) - How it's lit. Atmosphere.
5. **Shot** (sky blue) - How it's framed. Composition.
6. **Style** (violet) - Creative choices. Mood.
7. **Camera** (slate) - Technical execution.
8. **Audio** (indigo) - Sound design.
9. **Technical** (gray) - Specs. Least visual priority.

---

## Design Problems Solved

### Problem 1: Subject & Camera are both "main" colors

**Issue:** The previous setup had Subject as orange and Camera as blue - both strong, competing colors. But Subject is *what you're filming* while Camera is *how you're filming it*. Subject should dominate visually.

**Solution:** Make Camera neutral (slate gray), keep Subject warm (coral/orange).

### Problem 2: Technical and Style look too similar

**Issue:** Both were in the purple family (violet/fuchsia). Users couldn't distinguish them at a glance.

**Solution:** Technical becomes cool gray (it's metadata, least important), Style stays purple (creative choice).

### Problem 3: Shot and Camera are confused

**Issue:** Shot (framing) and Camera (movement/lens) are conceptually related but previously had very different colors (teal vs blue). They should feel related but distinguishable.

**Solution:** Shot becomes sky blue, Camera becomes slate. Both feel "technical" but Shot has more visual presence since it's compositionally more important than camera specs.

---

## Color Psychology & Semantics

### Warm Colors (High Priority)
- **Coral/Orange (Subject)**: Human, warm, draws attention. Represents the focal point.
- **Red (Action)**: Energy, movement, urgency. Paired with Subject as the dynamic duo.

### Natural Colors
- **Green (Environment)**: Universal association with place, nature, location.
- **Amber/Yellow (Lighting)**: The only logical choice for light itself.

### Cool Colors (Technical)
- **Sky Blue (Shot)**: Expansive, perspective, composition. The "window" through which we see.
- **Slate Gray (Camera)**: Neutral, technical, doesn't compete. Equipment/mechanics.
- **Cool Gray (Technical)**: Supporting information, lowest priority.

### Creative Colors
- **Violet (Style)**: Artistry, mood, creative flair. Aesthetic choices.
- **Deep Indigo (Audio)**: Frequency, depth, sound waves.

---

## Implementation

Colors are defined in `client/src/utils/PromptContext/categoryStyles.ts` in the `BASE_COLORS` object. Each category has multiple shades for subcategories/attributes, with the first shade being the primary color used for parent categories.

The color system is applied to:
- Text highlights in the editor
- Category badges and labels
- Visual indicators throughout the UI

---

## Color Accessibility

All color combinations meet WCAG AA contrast requirements:
- Background colors are light tints (50-100 level)
- Border colors are darker shades (500-600 level)
- Ensures readability while maintaining visual distinction

---

## Future Considerations

- Consider adding dark mode variants
- May need to adjust shades for better distinction in high-density displays
- Monitor user feedback on color associations and adjust if needed

