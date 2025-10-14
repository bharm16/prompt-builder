import React, { useRef, useEffect, useState, memo, useMemo } from 'react';
import {
  Copy,
  Download,
  Plus,
  FileText,
  Check,
  Info,
  X,
} from 'lucide-react';
import { SuggestionsPanel } from '../../components/PromptEnhancementEditor';
import { useToast } from '../../components/Toast';

/**
 * Text Formatting Layer - Applies 2025 Design Principles
 *
 * Transforms Claude's text output into formatted HTML with inline styles
 * for a contentEditable experience. Users can edit while maintaining formatting.
 */
const formatTextToHTML = (text) => {
  if (!text) return '';

  const lines = text.split('\n');
  let html = '';
  let i = 0;

  // Helper function to remove emojis
  const removeEmojis = (str) => {
    return str.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();
  };

  // Escape HTML to prevent XSS
  const escapeHtml = (str) => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  // Helper function to create flexible pattern variations
  const createFlexiblePattern = (phrases) => {
    // Add optional variations for common words
    return phrases.map(phrase => {
      // Make certain words optional or variable
      return phrase
        .replace(/\bslow\b/gi, '(?:slow|slowly)')
        .replace(/\bfast\b/gi, '(?:fast|quickly)')
        .replace(/\blight\b/gi, '(?:light|lighting)')
        .replace(/\bheavy\b/gi, '(?:heavy|thick)')
        .replace(/\bmist\b/gi, '(?:mist|fog|haze)')
        .replace(/\b(a|an|the)\s+/gi, '(?:a|an|the)?\\s*') // Optional articles
        .replace(/\s+/g, '\\s+'); // Normalize whitespace
    }).join('|');
  };

  // Highlight value words and phrases (descriptive terms, actions, etc.)
  const highlightValueWords = (text) => {
    if (!text) return '';

    // Enhanced categorized patterns for video/prompt generation
    // PHRASES come first - they take priority over individual words
    const patternCategories = {
      // Multi-word phrases (must be checked FIRST to avoid breaking them up)
      // Camera movement phrases (Purple/Violet)
      cameraPhrases: {
        pattern: /\b((?:slow|slowly)\s+zoom\s+(?:in|out)|(?:fast|quickly)\s+zoom\s+(?:in|out)|smooth\s+zoom|camera\s+zoom|camera\s+pan|camera\s+tilt|camera\s+tracking|dolly\s+shot|crane\s+shot|steadicam\s+shot|handheld\s+camera|aerial\s+shot|drone\s+shot|tracking\s+shot|following\s+shot|push\s+in\s+shot|pull\s+out\s+shot|rack\s+focus\s+transition|follow\s+focus\s+pull|whip\s+pan\s+transition|dutch\s+angle\s+shot|bird'?s\s+eye\s+view|worm'?s\s+eye\s+view|overhead\s+view|low\s+angle\s+shot|high\s+angle\s+shot|eye\s+level\s+shot|camera\s+movement|camera\s+motion)\b/gi,
        color: { bg: 'rgba(139, 92, 246, 0.12)', border: 'rgba(139, 92, 246, 0.4)' }
      },

      // Lighting phrases (Orange)
      lightingPhrases: {
        pattern: /\b(golden\s+hour\s+(?:lighting|light)|blue\s+hour\s+(?:lighting|light)|magic\s+hour\s+(?:lighting|light)|natural\s+light\s+streaming|artificial\s+light\s+sources?|ambient\s+light\s+glow|key\s+light\s+setup|rim\s+light\s+effect|back\s+light\s+silhouette|volumetric\s+light\s+rays?|god\s+rays?\s+streaming|lens\s+flare\s+effect|neon\s+(?:light|lights)\s+reflecting|neon\s+signs?\s+casting|(?:light|heavy)\s+(?:mist|fog)\s+hanging|soft\s+light\s+diffusing|hard\s+light\s+creating|diffused\s+light|direct\s+light|light\s+sources?|street\s+(?:light|lights)|traffic\s+lights?|colored\s+light|warm\s+light|cool\s+light|bright\s+light|dim\s+light|glowing\s+light)\b/gi,
        color: { bg: 'rgba(249, 115, 22, 0.12)', border: 'rgba(249, 115, 22, 0.4)' }
      },

      // Architectural and setting phrases (Blue)
      architecturalPhrases: {
        pattern: /\b(art deco facades|art deco architecture|geometric patterns|geometric shapes|architectural details|architectural elements|towering buildings|urban landscape|street canyon|city street|narrow corridor|fire escapes creating|building facades|glass windows|neon signs|street level|urban environment|metropolitan setting|city setting|urban setting)\b/gi,
        color: { bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.4)' }
      },

      // Environmental/atmospheric phrases (Cyan)
      atmosphericPhrases: {
        pattern: /\b((?:light|thin)\s+(?:mist|fog|haze)|(?:heavy|thick|dense)\s+(?:mist|fog|haze)|(?:morning|evening)\s+(?:mist|fog)|(?:mist|fog)\s+(?:hanging|diffusing)|(?:steam|smoke)\s+rising|rain\s+falling|wind\s+(?:stirring|blowing)|wet\s+(?:asphalt|pavement)\s+gleaming|wet\s+(?:asphalt|pavement)|reflective\s+surfaces?|puddles?\s+reflecting|shallow\s+puddles?|recent\s+rain|atmospheric\s+conditions?|weather\s+conditions?|environmental\s+conditions?)\b/gi,
        color: { bg: 'rgba(6, 182, 212, 0.12)', border: 'rgba(6, 182, 212, 0.4)' }
      },

      // Action phrases (Green)
      actionPhrases: {
        pattern: /\b(slowly walking|briskly walking|emerging from shadow|emerging from darkness|disappearing into darkness|disappearing into shadow|passing through|moving through|walking through|pools of light|pools of shadow|pools of streetlight|creating ripples|disturbing puddles|looking back|glancing back|turning around)\b/gi,
        color: { bg: 'rgba(34, 197, 94, 0.12)', border: 'rgba(34, 197, 94, 0.4)' }
      },

      // Technical cinematography phrases (Indigo)
      technicalPhrases: {
        pattern: /\b(shallow depth of field|deep depth of field|selective focus on|rack focus from|rack focus to|slow motion shot|time-lapse sequence|real-time capture|high frame rate|low frame rate|wide angle lens|telephoto lens|macro lens|fisheye lens|anamorphic lens|film grain texture|color grading applied|LUT applied|bokeh effect|motion blur|lens flare)\b/gi,
        color: { bg: 'rgba(99, 102, 241, 0.12)', border: 'rgba(99, 102, 241, 0.4)' }
      },

      // Visual/descriptive phrases (Amber/Yellow)
      descriptivePhrases: {
        pattern: /\b(highly detailed|extremely detailed|meticulously detailed|vibrant colors|muted colors|warm colors|cool colors|dark shadows|deep shadows|bright highlights|soft highlights|harsh contrast|subtle contrast|organic textures|geometric patterns|symmetrical composition|balanced composition|dramatic lighting|cinematic lighting|moody atmosphere|ethereal atmosphere|dreamy quality|surreal quality)\b/gi,
        color: { bg: 'rgba(250, 204, 21, 0.15)', border: 'rgba(250, 204, 21, 0.4)' }
      },

      // Color phrases (Pink/Rose)
      colorPhrases: {
        pattern: /\b(neon red|neon blue|neon green|neon pink|deep red|bright red|dark blue|light blue|golden yellow|warm orange|cool blue|vibrant green|muted brown|charcoal gray|silver gray|colored light)\b/gi,
        color: { bg: 'rgba(244, 63, 94, 0.12)', border: 'rgba(244, 63, 94, 0.4)' }
      },

      // INDIVIDUAL WORDS (checked after phrases)
      // Camera movements and technical operations (Purple/Violet)
      camera: {
        pattern: /\b(zooming|panning|tilting|tracking|dolly|crane|steadicam|handheld|aerial|drone|orbiting|circling)\b/gi,
        color: { bg: 'rgba(139, 92, 246, 0.12)', border: 'rgba(139, 92, 246, 0.4)' }
      },

      // Visual descriptors and aesthetics (Amber/Yellow)
      descriptive: {
        pattern: /\b(dramatic|cinematic|beautiful|stunning|elegant|modern|vintage|retro|futuristic|professional|creative|dynamic|atmospheric|intimate|bold|subtle|vibrant|muted|warm|cool|cold|hot|dark|bright|dim|soft|harsh|smooth|rough|minimalist|maximalist|detailed|simple|complex|clean|messy|sleek|rugged|delicate|powerful|gentle|intense|calm|energetic|peaceful|chaotic|serene|moody|ethereal|dreamy|surreal|realistic|abstract|organic|geometric|symmetrical|asymmetrical|balanced|contrasted|saturated|desaturated|monochrome|colorful|pastel|metallic|glossy|matte|textured|grainy|crisp)\b/gi,
        color: { bg: 'rgba(250, 204, 21, 0.15)', border: 'rgba(250, 204, 21, 0.4)' }
      },

      // Subjects and composition elements (Blue)
      subjects: {
        pattern: /\b(person|people|figure|character|subject|protagonist|model|actor|silhouette|crowd|group|individual|face|portrait|product|object|item|camera|lens|scene|background|foreground|midground|environment|location|setting|landscape|cityscape|interior|exterior|studio|stage|set|composition|framing|frame|shot|angle|perspective|layout|arrangement|debris|litter|storefronts|windows|cars|buildings|facades|corridor|canyon)\b/gi,
        color: { bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.4)' }
      },

      // Actions and movements (Green)
      actions: {
        pattern: /\b(walking|running|standing|sitting|lying|leaning|moving|floating|flying|falling|rising|ascending|descending|dancing|jumping|leaping|turning|spinning|rotating|twisting|swaying|drifting|gliding|sliding|emerging|disappearing|fading|appearing|revealing|concealing|approaching|receding|gesturing|reaching|pointing|looking|gazing|staring|stirring|creating|disturbing|casting|suggesting)\b/gi,
        color: { bg: 'rgba(34, 197, 94, 0.12)', border: 'rgba(34, 197, 94, 0.4)' }
      },

      // Lighting and time (Orange)
      lighting: {
        pattern: /\b(sunrise|sunset|dawn|dusk|twilight|morning|afternoon|evening|night|midnight|noon|daylight|moonlight|sunlight|starlight|candlelight|lamplight|shadows|highlights|lowlights|midtones|backlit|frontlit|sidelit|volumetric|glow|glowing|shimmering|sparkling|reflecting|reflections|gleaming)\b/gi,
        color: { bg: 'rgba(249, 115, 22, 0.12)', border: 'rgba(249, 115, 22, 0.4)' }
      },

      // Technical cinematography terms (Indigo)
      technical: {
        pattern: /\b(bokeh|focus|blur|blurred|sharp|sharpness|macro|fps|exposure|overexposed|underexposed|resolution|4K|8K|HDR|anamorphic|spherical|compression|grain|noise|vignette|LUT)\b/gi,
        color: { bg: 'rgba(99, 102, 241, 0.12)', border: 'rgba(99, 102, 241, 0.4)' }
      },

      // Colors and materials (Pink/Rose)
      colors: {
        pattern: /\b(red|crimson|scarlet|maroon|orange|amber|yellow|gold|golden|green|emerald|teal|cyan|blue|navy|indigo|purple|violet|lavender|magenta|pink|rose|brown|beige|tan|white|ivory|cream|black|charcoal|gray|grey|silver|bronze|copper|sepia|turquoise|coral|sage|olive|burgundy|rust|peach|neon)\b/gi,
        color: { bg: 'rgba(244, 63, 94, 0.12)', border: 'rgba(244, 63, 94, 0.4)' }
      },

      // Weather and environmental conditions (Cyan)
      environment: {
        pattern: /\b(sunny|cloudy|overcast|rainy|stormy|foggy|misty|hazy|clear|windy|snowy|icy|humid|dry|wet|dusty|smoky|smoggy|thunder|lightning|rainbow|aurora|stars|starry|moonlit|mist|fog|rain|steam|smoke)\b/gi,
        color: { bg: 'rgba(6, 182, 212, 0.12)', border: 'rgba(6, 182, 212, 0.4)' }
      },

      // Emotions and mood (Emerald)
      emotions: {
        pattern: /\b(happy|joyful|sad|melancholic|angry|peaceful|tense|relaxed|excited|anxious|confident|mysterious|playful|serious|romantic|lonely|nostalgic|hopeful|ominous|threatening|welcoming|friendly|hostile|isolation|solitude|fatigue|injury|tension|deliberate|controlled|intimate|dwarfed|imposing|vertical|reflective|darkened|occasional|scattered|empty|late)\b/gi,
        color: { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.4)' }
      },

      // Numbers and measurements (Slate)
      measurements: {
        pattern: /\b(\d+(?:\.\d+)?(?:mm|fps|k|hz|seconds?|mins?|minutes?|hours?|degrees?|percent|%|meters?|feet|inches?|f\/\d+\.?\d*))\b/gi,
        color: { bg: 'rgba(100, 116, 139, 0.12)', border: 'rgba(100, 116, 139, 0.4)' }
      }
    };

    // Process text with all pattern categories
    let result = '';
    let lastIndex = 0;
    const matches = [];

    // Collect all matches from all categories
    Object.entries(patternCategories).forEach(([category, { pattern, color }]) => {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match;
      while ((match = regex.exec(text)) !== null) {
        matches.push({
          text: match[0],
          start: match.index,
          end: match.index + match[0].length,
          category,
          color,
          // Add priority: phrases (longer) have higher priority than individual words
          length: match[0].length,
          // Phrase categories get extra priority boost
          isPhraseCategory: category.endsWith('Phrases')
        });
      }
    });

    // Sort matches by:
    // 1. Start position (primary)
    // 2. Length descending (longer matches first at same position)
    // 3. Phrase category priority
    matches.sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      if (a.length !== b.length) return b.length - a.length; // Longer first
      if (a.isPhraseCategory !== b.isPhraseCategory) {
        return a.isPhraseCategory ? -1 : 1; // Phrases first
      }
      return 0;
    });

    // Context-aware category priority for ambiguous words
    // Some words appear in multiple categories - choose best based on surrounding context
    const getContextualCategory = (match, allMatches) => {
      // If it's a phrase category, it's already specific
      if (match.isPhraseCategory) return match.category;

      // Look at nearby matches within 50 characters
      const nearbyMatches = allMatches.filter(m =>
        m !== match &&
        Math.abs(m.start - match.start) < 50
      );

      // Count category occurrences in nearby context
      const categoryCounts = {};
      nearbyMatches.forEach(m => {
        const baseCategory = m.category.replace(/Phrases$/, '');
        categoryCounts[baseCategory] = (categoryCounts[baseCategory] || 0) + 1;
      });

      // If nearby context has same category, boost priority
      const baseCategory = match.category.replace(/Phrases$/, '');
      if (categoryCounts[baseCategory] > 1) {
        match.contextBoost = 10; // Boost matches in consistent context
      }

      return match.category;
    };

    // Apply contextual analysis
    matches.forEach(match => {
      match.category = getContextualCategory(match, matches);
      match.contextBoost = match.contextBoost || 0;
    });

    // Intelligent overlap removal:
    // - Prioritize longer, more specific matches
    // - Consider contextual relevance
    // - Prefer phrase categories over word categories
    const filteredMatches = [];

    matches.forEach(match => {
      // Check if this match overlaps with any already selected matches
      const hasOverlap = filteredMatches.some(existing => {
        // Matches overlap if one starts before the other ends
        return !(match.end <= existing.start || match.start >= existing.end);
      });

      // If no overlap, add it
      if (!hasOverlap) {
        filteredMatches.push(match);
      } else {
        // Check if this match is longer/better than overlapping match
        const overlappingMatch = filteredMatches.find(existing =>
          !(match.end <= existing.start || match.start >= existing.end)
        );

        // Calculate match quality score
        const getMatchScore = (m) => {
          let score = m.length; // Base score on length
          if (m.isPhraseCategory) score += 20; // Phrase bonus
          score += m.contextBoost || 0; // Context bonus
          return score;
        };

        // Replace if this match is significantly better
        if (overlappingMatch) {
          const currentScore = getMatchScore(match);
          const existingScore = getMatchScore(overlappingMatch);

          if (currentScore > existingScore) {
            const index = filteredMatches.indexOf(overlappingMatch);
            filteredMatches.splice(index, 1);
            filteredMatches.push(match);
          }
        }
      }
    });

    // Re-sort filtered matches by start position for rendering
    filteredMatches.sort((a, b) => a.start - b.start);

    // Build result with highlighted matches
    filteredMatches.forEach(match => {
      // Add text before match
      result += escapeHtml(text.slice(lastIndex, match.start));

      // Add highlighted match with category-specific color
      result += `<span class="value-word value-word-${match.category}" data-category="${match.category}" style="background-color: ${match.color.bg}; border-bottom: 1px solid ${match.color.border}; padding: 0 2px; border-radius: 2px; cursor: pointer; transition: all 0.15s ease;">${escapeHtml(match.text)}</span>`;

      lastIndex = match.end;
    });

    // Add remaining text
    result += escapeHtml(text.slice(lastIndex));

    return result;
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Skip empty lines but preserve spacing
    if (!trimmedLine) {
      html += '<div style="height: 0.5rem;"></div>';
      i++;
      continue;
    }

    // Headers surrounded by separator lines
    if (trimmedLine.match(/^[=\-*_━─═▬▭]+$/)) {
      if (i + 2 < lines.length) {
        const nextLine = lines[i + 1].trim();
        const afterLine = lines[i + 2].trim();

        if (nextLine && nextLine.length > 0 && afterLine.match(/^[=\-*_━─═▬▭]+$/)) {
          const cleanText = highlightValueWords(removeEmojis(nextLine));
          html += `<h1 style="font-size: 1.5rem; font-weight: 700; color: rgb(23, 23, 23); margin-bottom: 1.5rem; margin-top: 3rem; line-height: 1.2; letter-spacing: -0.025em;">${cleanText}</h1>`;
          i += 3;
          continue;
        }
      }
      i++;
      continue;
    }

    // Main headings (ALL CAPS or lines with ### or **)
    if (trimmedLine.match(/^[A-Z\s]{5,}:?$/) ||
        trimmedLine.match(/^#{1,3}\s+(.+)$/) ||
        trimmedLine.match(/^\*\*(.+)\*\*:?$/)) {
      const cleanText = highlightValueWords(removeEmojis(
        trimmedLine
          .replace(/^#+\s+/, '')
          .replace(/^\*\*(.+)\*\*:?$/, '$1')
          .replace(/:$/, '')
      ));
      html += `<h2 style="font-size: 1.25rem; font-weight: 600; color: rgb(23, 23, 23); margin-bottom: 1rem; margin-top: 2rem; line-height: 1.2; letter-spacing: -0.025em;">${cleanText}</h2>`;
      i++;
      continue;
    }

    // Section headers (lines ending with colon)
    if (trimmedLine.match(/^.+:$/)) {
      const cleanText = highlightValueWords(removeEmojis(trimmedLine.replace(/:$/, '')));
      html += `<h3 style="font-size: 1rem; font-weight: 600; color: rgb(38, 38, 38); margin-bottom: 0.75rem; margin-top: 1.5rem; line-height: 1.2; letter-spacing: -0.025em;">${cleanText}</h3>`;
      i++;
      continue;
    }

    // Bullet points
    if (trimmedLine.match(/^[-•]\s+(.+)$/)) {
      const cleanText = highlightValueWords(removeEmojis(trimmedLine.replace(/^[-•]\s+/, '')));
      html += `<div style="display: flex; gap: 0.75rem; margin-bottom: 0.5rem;"><span style="color: rgb(163, 163, 163); margin-top: 0.25rem; flex-shrink: 0;">•</span><p style="font-size: 15px; color: rgb(64, 64, 64); line-height: 1.625; flex: 1; margin: 0;">${cleanText}</p></div>`;
      i++;
      continue;
    }

    // Numbered lists
    if (trimmedLine.match(/^\d+\.\s+(.+)$/)) {
      const match = trimmedLine.match(/^(\d+)\.\s+(.+)$/);
      const cleanText = highlightValueWords(removeEmojis(match[2]));
      html += `<div style="display: flex; gap: 0.75rem; margin-bottom: 0.5rem;"><span style="color: rgb(115, 115, 115); font-weight: 500; margin-top: 0.125rem; flex-shrink: 0; font-size: 0.875rem;">${match[1]}.</span><p style="font-size: 15px; color: rgb(64, 64, 64); line-height: 1.625; flex: 1; margin: 0;">${cleanText}</p></div>`;
      i++;
      continue;
    }

    // Regular paragraph text
    let paragraphLines = [trimmedLine];
    i++;
    while (i < lines.length &&
           lines[i].trim() &&
           !lines[i].trim().match(/^[-•]\s+/) &&
           !lines[i].trim().match(/^\d+\.\s+/) &&
           !lines[i].trim().match(/^[A-Z\s]{5,}:?$/) &&
           !lines[i].trim().match(/^.+:$/) &&
           !lines[i].trim().match(/^#{1,3}\s+/) &&
           !lines[i].trim().match(/^\*\*(.+)\*\*:?$/) &&
           !lines[i].trim().match(/^[=\-*_━─═▬▭]+$/)) {
      paragraphLines.push(lines[i].trim());
      i++;
    }

    const paragraphText = highlightValueWords(removeEmojis(paragraphLines.join(' ').replace(/\*\*/g, '')));
    html += `<p style="font-size: 15px; color: rgb(64, 64, 64); line-height: 1.625; margin-bottom: 1rem;">${paragraphText}</p>`;
  }

  return html;
};

// Category Legend Component
const CategoryLegend = memo(({ show, onClose }) => {
  if (!show) return null;

  const categories = [
    { name: 'Camera', color: 'rgba(139, 92, 246, 0.12)', border: 'rgba(139, 92, 246, 0.4)', example: 'slow zoom in, aerial shot, panning' },
    { name: 'Descriptive', color: 'rgba(250, 204, 21, 0.15)', border: 'rgba(250, 204, 21, 0.4)', example: 'dramatic lighting, vibrant colors' },
    { name: 'Subjects', color: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.4)', example: 'art deco facades, urban landscape' },
    { name: 'Actions', color: 'rgba(34, 197, 94, 0.12)', border: 'rgba(34, 197, 94, 0.4)', example: 'emerging from shadow, walking through' },
    { name: 'Lighting', color: 'rgba(249, 115, 22, 0.12)', border: 'rgba(249, 115, 22, 0.4)', example: 'golden hour lighting, neon signs casting' },
    { name: 'Technical', color: 'rgba(99, 102, 241, 0.12)', border: 'rgba(99, 102, 241, 0.4)', example: 'shallow depth of field, bokeh effect' },
    { name: 'Colors', color: 'rgba(244, 63, 94, 0.12)', border: 'rgba(244, 63, 94, 0.4)', example: 'neon red, golden yellow, deep shadows' },
    { name: 'Environment', color: 'rgba(6, 182, 212, 0.12)', border: 'rgba(6, 182, 212, 0.4)', example: 'light mist hanging, wet asphalt gleaming' },
    { name: 'Emotions', color: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.4)', example: 'peaceful, mysterious, late hour' },
    { name: 'Measurements', color: 'rgba(100, 116, 139, 0.12)', border: 'rgba(100, 116, 139, 0.4)', example: '24fps, 50mm, f/2.8' },
  ];

  return (
    <div className="fixed top-20 right-6 z-30 w-80 bg-white border border-neutral-200 rounded-lg shadow-lg">
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-neutral-500" />
          <h3 className="text-sm font-semibold text-neutral-900">Highlight Categories</h3>
        </div>
        <button
          onClick={onClose}
          className="text-neutral-400 hover:text-neutral-600 transition-colors"
          aria-label="Close legend"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="p-3 max-h-96 overflow-y-auto">
        <div className="space-y-2">
          {categories.map((cat) => (
            <div key={cat.name} className="flex items-start gap-2">
              <div
                className="flex-shrink-0 w-16 h-6 rounded border mt-0.5"
                style={{
                  backgroundColor: cat.color,
                  borderColor: cat.border,
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-neutral-900">{cat.name}</div>
                <div className="text-xs text-neutral-500 truncate">{cat.example}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-neutral-200">
          <p className="text-xs text-neutral-500 leading-relaxed">
            The system highlights both individual words and complete phrases. Click any highlight to get AI-powered alternative suggestions. Phrases like "art deco facades" or "light mist hanging" are recognized as complete units.
          </p>
        </div>
      </div>
    </div>
  );
});

CategoryLegend.displayName = 'CategoryLegend';

// Minimal Floating Toolbar Component
const FloatingToolbar = memo(({
  onCopy,
  onExport,
  onCreateNew,
  copied,
  showExportMenu,
  onToggleExportMenu,
  showLegend,
  onToggleLegend
}) => {
  const exportMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        onToggleExportMenu(false);
      }
    };

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showExportMenu, onToggleExportMenu]);

  return (
    <div className="fixed top-4 right-6 z-20 flex items-center gap-1 bg-white border border-neutral-200 rounded-lg shadow-sm px-1 py-1">
      <button
        onClick={onCopy}
        className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
          copied
            ? 'text-green-700 bg-green-50'
            : 'text-neutral-700 hover:bg-neutral-100'
        }`}
        aria-label={copied ? 'Prompt copied' : 'Copy prompt'}
        title="Copy"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied && <span className="text-xs">Copied</span>}
      </button>

      <button
        onClick={() => onToggleLegend(!showLegend)}
        className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
          showLegend
            ? 'text-blue-700 bg-blue-50'
            : 'text-neutral-700 hover:bg-neutral-100'
        }`}
        aria-label="Toggle highlight legend"
        title="Highlight Legend"
      >
        <Info className="h-4 w-4" />
      </button>

      <div className="relative" ref={exportMenuRef}>
        <button
          onClick={() => onToggleExportMenu(!showExportMenu)}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-neutral-700 rounded-md hover:bg-neutral-100 transition-colors"
          aria-expanded={showExportMenu}
          title="Export"
        >
          <Download className="h-4 w-4" />
        </button>
        {showExportMenu && (
          <div className="absolute top-full right-0 mt-2 w-40 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 z-30">
            <button
              onClick={() => onExport('text')}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              <FileText className="h-4 w-4" />
              Text (.txt)
            </button>
            <button
              onClick={() => onExport('markdown')}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              <FileText className="h-4 w-4" />
              Markdown (.md)
            </button>
            <button
              onClick={() => onExport('json')}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              <FileText className="h-4 w-4" />
              JSON (.json)
            </button>
          </div>
        )}
      </div>

      <div className="w-px h-6 bg-neutral-200 mx-1" />

      <button
        onClick={onCreateNew}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-white bg-neutral-900 rounded-md hover:bg-neutral-800 transition-colors"
        title="New prompt"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
});

FloatingToolbar.displayName = 'FloatingToolbar';

// Main PromptCanvas Component
export const PromptCanvas = ({
  inputPrompt,
  displayedPrompt,
  optimizedPrompt,
  qualityScore,
  selectedMode,
  currentMode,
  onDisplayedPromptChange,
  onSkipAnimation,
  suggestionsData,
  onFetchSuggestions,
  onCreateNew
}) => {
  const [copied, setCopied] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showLegend, setShowLegend] = useState(false);

  const editorRef = useRef(null);
  const toast = useToast();

  // Memoize formatted HTML
  const formattedHTML = useMemo(() => formatTextToHTML(displayedPrompt), [displayedPrompt]);

  const handleCopy = () => {
    navigator.clipboard.writeText(displayedPrompt);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = (format) => {
    let content = '';
    const timestamp = new Date().toLocaleString();

    if (format === 'markdown') {
      content = `# Prompt Optimization\n\n**Date:** ${timestamp}\n\n## Original Prompt\n${inputPrompt}\n\n## Optimized Prompt\n${displayedPrompt}`;
    } else if (format === 'json') {
      content = JSON.stringify(
        {
          timestamp,
          original: inputPrompt,
          optimized: displayedPrompt,
          qualityScore,
          mode: selectedMode,
        },
        null,
        2
      );
    } else {
      content = `PROMPT OPTIMIZATION\nDate: ${timestamp}\n\n=== ORIGINAL ===\n${inputPrompt}\n\n=== OPTIMIZED ===\n${displayedPrompt}`;
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompt-optimization.${format === 'json' ? 'json' : format === 'markdown' ? 'md' : 'txt'}`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
    toast.success(`Exported as ${format.toUpperCase()}`);
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    let text = selection.toString().trim();

    if (text.length > 0 && onFetchSuggestions) {
      const cleanedText = text.replace(/^-\s*/, '');
      const range = selection.getRangeAt(0).cloneRange();
      // Use original displayedPrompt (without formatting) for suggestions context
      onFetchSuggestions(cleanedText, text, displayedPrompt, range);
    }
  };

  // Handle clicks on highlighted words
  const handleHighlightClick = (e) => {
    // Check if clicked element or its parent is a highlighted word
    let targetElement = e.target;

    // Traverse up to find a value-word span (in case user clicks on text inside the span)
    while (targetElement && targetElement !== editorRef.current) {
      if (targetElement.classList && targetElement.classList.contains('value-word')) {
        // Prevent default text selection behavior
        e.preventDefault();

        // Get the word text
        const wordText = targetElement.textContent.trim();

        if (wordText && onFetchSuggestions) {
          // Create a range for the clicked word
          const range = document.createRange();
          range.selectNodeContents(targetElement);

          // Clear any existing selection
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);

          // Trigger suggestions for this word
          onFetchSuggestions(wordText, wordText, displayedPrompt, range);
        }

        return;
      }
      targetElement = targetElement.parentElement;
    }
  };

  const handleCopyEvent = (e) => {
    // Always copy the original unformatted text
    e.clipboardData.setData('text/plain', displayedPrompt);
    e.preventDefault();
  };

  const handleInput = (e) => {
    // Extract plain text from the contentEditable div
    const newText = e.currentTarget.innerText || e.currentTarget.textContent || '';
    if (onDisplayedPromptChange) {
      onDisplayedPromptChange(newText);
    }
  };

  // Update the editor content when displayedPrompt changes
  useEffect(() => {
    if (editorRef.current && displayedPrompt) {
      const newHTML = formattedHTML || displayedPrompt;

      // Only update if content has actually changed to preserve cursor position
      const currentText = editorRef.current.innerText || editorRef.current.textContent || '';
      const newText = displayedPrompt;

      if (currentText !== newText) {
        const selection = window.getSelection();
        const hadFocus = document.activeElement === editorRef.current;
        let cursorPosition = 0;

        // Try to save cursor position
        if (hadFocus && selection.rangeCount > 0) {
          try {
            const range = selection.getRangeAt(0);
            cursorPosition = range.startOffset;
          } catch (e) {
            // Ignore cursor position errors
          }
        }

        // Set the HTML content
        editorRef.current.innerHTML = newHTML;

        // Restore focus and cursor if it had focus before
        if (hadFocus) {
          try {
            editorRef.current.focus();
          } catch (e) {
            // Ignore focus errors
          }
        }
      }
    } else if (editorRef.current && !displayedPrompt) {
      editorRef.current.innerHTML = '<p style="color: rgb(163, 163, 163); font-size: 0.875rem;">Your optimized prompt will appear here...</p>';
    }
  }, [displayedPrompt, formattedHTML]);

  return (
    <div className="fixed inset-0 flex bg-neutral-50" style={{ marginLeft: 'var(--sidebar-width, 0px)' }}>
      {/* Inject CSS for value word hover effects */}
      <style>{`
        /* Base value word styles */
        .value-word {
          position: relative;
          user-select: text;
          -webkit-user-select: text;
          -moz-user-select: text;
          -ms-user-select: text;
        }

        /* Enhanced hover effects for all categories */
        .value-word:hover {
          filter: brightness(0.95);
          border-bottom-width: 2px !important;
          transform: translateY(-0.5px);
          cursor: pointer !important;
        }

        .value-word:active {
          transform: translateY(0px);
        }

        /* Category-specific hover enhancements */
        .value-word-camera:hover {
          background-color: rgba(139, 92, 246, 0.2) !important;
          border-bottom-color: rgba(139, 92, 246, 0.6) !important;
        }

        .value-word-descriptive:hover {
          background-color: rgba(250, 204, 21, 0.25) !important;
          border-bottom-color: rgba(250, 204, 21, 0.6) !important;
        }

        .value-word-subjects:hover {
          background-color: rgba(59, 130, 246, 0.2) !important;
          border-bottom-color: rgba(59, 130, 246, 0.6) !important;
        }

        .value-word-actions:hover {
          background-color: rgba(34, 197, 94, 0.2) !important;
          border-bottom-color: rgba(34, 197, 94, 0.6) !important;
        }

        .value-word-lighting:hover {
          background-color: rgba(249, 115, 22, 0.2) !important;
          border-bottom-color: rgba(249, 115, 22, 0.6) !important;
        }

        .value-word-technical:hover {
          background-color: rgba(99, 102, 241, 0.2) !important;
          border-bottom-color: rgba(99, 102, 241, 0.6) !important;
        }

        .value-word-colors:hover {
          background-color: rgba(244, 63, 94, 0.2) !important;
          border-bottom-color: rgba(244, 63, 94, 0.6) !important;
        }

        .value-word-environment:hover {
          background-color: rgba(6, 182, 212, 0.2) !important;
          border-bottom-color: rgba(6, 182, 212, 0.6) !important;
        }

        .value-word-emotions:hover {
          background-color: rgba(16, 185, 129, 0.2) !important;
          border-bottom-color: rgba(16, 185, 129, 0.6) !important;
        }

        .value-word-measurements:hover {
          background-color: rgba(100, 116, 139, 0.2) !important;
          border-bottom-color: rgba(100, 116, 139, 0.6) !important;
        }

        /* Tooltip on hover - shows category */
        .value-word::before {
          content: attr(data-category);
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%) translateY(-4px);
          background-color: rgba(23, 23, 23, 0.9);
          color: white;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 500;
          text-transform: capitalize;
          white-space: nowrap;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease, transform 0.2s ease;
          z-index: 1000;
          letter-spacing: 0.5px;
        }

        .value-word::after {
          content: '';
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%) translateY(-4px);
          border: 4px solid transparent;
          border-top-color: rgba(23, 23, 23, 0.9);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease, transform 0.2s ease;
          z-index: 1000;
        }

        .value-word:hover::before,
        .value-word:hover::after {
          opacity: 1;
          transform: translateX(-50%) translateY(-8px);
        }

        .value-word:hover::after {
          transform: translateX(-50%) translateY(-4px);
        }

        /* Prevent tooltip overflow */
        [contenteditable] {
          position: relative;
        }
      `}</style>

      {/* Floating Toolbar */}
      <FloatingToolbar
        onCopy={handleCopy}
        onExport={handleExport}
        onCreateNew={onCreateNew}
        copied={copied}
        showExportMenu={showExportMenu}
        onToggleExportMenu={setShowExportMenu}
        showLegend={showLegend}
        onToggleLegend={setShowLegend}
      />

      {/* Category Legend */}
      <CategoryLegend show={showLegend} onClose={() => setShowLegend(false)} />

      {/* Main Content Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Narrow Left Sidebar - Original Prompt */}
        <div className="w-72 flex-shrink-0 flex flex-col border-r border-neutral-200 bg-neutral-50 overflow-hidden">
          <div className="flex-shrink-0 px-5 py-4 border-b border-neutral-200 bg-white">
            <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
              Your Input
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="px-5 py-5">
              <div
                className="text-[13px] text-neutral-600 whitespace-pre-wrap"
                style={{
                  lineHeight: '1.6',
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
                  letterSpacing: '-0.01em'
                }}
              >
                {inputPrompt}
              </div>
            </div>
          </div>
        </div>

        {/* Main Editor Area - Optimized Prompt */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-12 py-16">
              <div
                ref={editorRef}
                onMouseUp={handleTextSelection}
                onClick={handleHighlightClick}
                onCopy={handleCopyEvent}
                onInput={handleInput}
                contentEditable
                suppressContentEditableWarning
                className="min-h-[calc(100vh-8rem)] outline-none focus:outline-none cursor-text"
                style={{
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
                  caretColor: 'rgb(23, 23, 23)',
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                }}
                role="textbox"
                aria-label="Optimized prompt"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - AI Suggestions Panel (Always Visible) */}
      <SuggestionsPanel suggestionsData={suggestionsData || { show: false }} />
    </div>
  );
};
