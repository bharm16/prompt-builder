# Fix: AI Suggestions Now Match Highlighted Category

## Problem
When clicking on highlighted text in video prompts, AI suggestions ignored the category of the clicked word. For example:
- Click "golden hour" (Lighting/TimeOfDay) → Get camera or subject suggestions
- Click "wide shot" (Framing) → Get lighting or location suggestions

## Root Cause
Category names from the span labeler (`TimeOfDay`, `Wardrobe`, `Appearance`, `CameraMove`) didn't match the regex patterns in `EnhancementService.mapCategory()`, causing them to fall back to generic context analysis.

## Changes Made

### 1. Fixed Category Mapping (`EnhancementService.js` line ~1760)

**Added support for all span labeler categories:**
- `TimeOfDay` → Maps to "lighting description"
- `Wardrobe` → Maps to "wardrobe and costume detail"
- `Appearance` → Maps to "subject or character detail"
- `CameraMove` → Maps to "camera or framing description"
- `Color` → Maps to "color and visual tone"
- `Technical` → Maps to "technical specification"
- `Descriptive` → Maps to "general visual detail"

**Added lowercase normalization** to handle case variations.

**Added debug logging** to track category mapping.

### 2. Added Category-Specific Focus Guidance (New method line ~1757)

Created `getCategoryFocusGuidance()` method that provides tailored guidance for each category:

**Lighting:**
- Light direction, quality, color temperature, contrast ratio, practical sources

**Camera/Framing:**
- Movement, lens choice, angle, shot size, focus technique

**Subject/Character:**
- Physical characteristics, facial details, posture, movement quality

**Wardrobe:**
- Garment specifics, condition, era markers, color palette, accessories

**Environment/Location:**
- Architectural details, atmospheric conditions, spatial relationships

**Color:**
- Color palette, relationships, grading, dominant/accent colors

**Style/Aesthetic:**
- Film stock, genre aesthetic, cinematographer references, post-processing

**Technical:**
- Duration, frame rate, resolution, camera body, technical effects

### 3. Added Category Emphasis to AI Prompt (line ~1115)

Added explicit instruction to the AI:
```
🎯 **CRITICAL**: User clicked on LIGHTING text. 
ALL 5 suggestions MUST focus exclusively on lighting description. 
Do NOT suggest alternatives for other categories.
```

## Testing

### Before Fix:
```
User clicks: "golden hour" (TimeOfDay category)
Category mapping: FAILS (no match for "timeofday")
Falls back to: context analysis → "general visual detail"
AI prompt: Generic focus list (all categories)
Result: Mixed suggestions (camera angles, subject details, etc.)
```

### After Fix:
```
User clicks: "golden hour" (TimeOfDay category)
Category mapping: SUCCESS → "lighting description"
AI prompt: Category emphasis + lighting-specific focus guidance
Result: Only lighting suggestions:
  - "warm backlight with 3:1 contrast ratio"
  - "soft diffused window light from camera left"
  - "low-angle sun creating long dramatic shadows"
```

## How to Verify

1. **Open a video prompt** with highlighted text
2. **Click on a lighting term** (e.g., "golden hour", "soft light")
3. **Check suggestions panel** - all suggestions should focus on lighting
4. **Try other categories:**
   - Framing: "wide shot", "close-up" → camera/framing suggestions
   - Wardrobe: "worn jacket", "leather boots" → wardrobe suggestions
   - Subject: "elderly man", "weathered hands" → subject/appearance suggestions

## Console Logs to Check

Look for:
```
[DEBUG] Category mapped from explicit category: { 
  input: 'timeofday', 
  output: 'lighting description' 
}
```

This confirms the category is being correctly mapped.

## Files Modified

1. `/server/src/services/EnhancementService.js`
   - Enhanced `mapCategory()` function (101 lines added)
   - Added `getCategoryFocusGuidance()` method
   - Added category emphasis to prompt generation

## Impact

- ✅ Suggestions now respect the clicked category
- ✅ More relevant and focused alternatives
- ✅ Better user experience - get what you expect
- ✅ Improved AI prompt quality with category-specific guidance
- ✅ Debug logging for troubleshooting

## Related Issue

This fix ensures the span labeler categories (used for highlighting) properly connect to the enhancement suggestion system, creating a consistent user experience where clicking on text gets you relevant alternatives for that specific aspect of the video prompt.
