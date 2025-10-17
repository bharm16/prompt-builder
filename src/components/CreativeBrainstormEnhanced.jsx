import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Sparkles,
  ArrowRight,
  Lightbulb,
  MapPin,
  User,
  Calendar,
  Zap,
  Palette,
  Loader2,
  X,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Info,
  Wand2,
  Brain,
  BookOpen,
} from 'lucide-react';

// Element dependency hierarchy
const ELEMENT_HIERARCHY = {
  subject: { priority: 1, dependencies: [] },
  action: { priority: 2, dependencies: ['subject'] },
  location: { priority: 3, dependencies: ['subject', 'action'] },
  time: { priority: 4, dependencies: ['location'] },
  mood: { priority: 5, dependencies: ['subject', 'action'] },
  style: { priority: 6, dependencies: ['mood'] },
  event: { priority: 7, dependencies: ['subject', 'action'] },
};

// Element groups for smart organization
const ELEMENT_GROUPS = {
  core: ['subject', 'action', 'location'],
  atmosphere: ['mood', 'time'],
  style: ['style'],
  context: ['event'],
};

// Template library
const TEMPLATE_LIBRARY = {
  productDemo: {
    name: 'Product Demo',
    elements: {
      subject: 'sleek smartphone with titanium frame and glowing display',
      action: 'rotating slowly on turntable',
      location: 'minimalist white studio with soft shadows',
      time: 'soft even lighting from above',
      mood: 'professional and pristine',
      style: 'shot on RED camera with shallow depth of field',
      event: 'product reveal moment',
    },
  },
  natureScene: {
    name: 'Nature Doc',
    elements: {
      subject: 'snow leopard with thick spotted coat',
      action: 'stalking prey through deep snow',
      location: 'himalayan mountain ridge at dawn',
      time: 'golden hour with warm backlight',
      mood: 'majestic and tense',
      style: 'documentary verité handheld with telephoto lens',
      event: 'wildlife hunting behavior',
    },
  },
  urbanAction: {
    name: 'Urban Action',
    elements: {
      subject: 'parkour athlete in black tactical gear',
      action: 'vaulting over concrete barriers in slow motion',
      location: 'rain-slicked city rooftops with neon signs',
      time: 'blue hour dusk with deep shadows',
      mood: 'energetic with high tension',
      style: 'shot on 35mm film with dynamic camera movement',
      event: 'rooftop chase sequence',
    },
  },
};

export default function CreativeBrainstormEnhanced({
  onConceptComplete,
  initialConcept = '',
}) {
  // Core state
  const [mode, setMode] = useState('element');
  const [concept, setConcept] = useState(initialConcept);
  const [elements, setElements] = useState({
    subject: '',
    action: '',
    location: '',
    time: '',
    mood: '',
    style: '',
    event: '',
  });

  // UI state
  const [activeElement, setActiveElement] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [compatibilityScores, setCompatibilityScores] = useState({});
  const [conflicts, setConflicts] = useState([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [validationScore, setValidationScore] = useState(null);
  const [elementHistory, setElementHistory] = useState([]);
  const [refinementSuggestions, setRefinementSuggestions] = useState({});
  const [showGuidance, setShowGuidance] = useState(false);

  const previousElementsRef = useRef(elements);

  const elementConfig = {
    subject: {
      icon: User,
      label: 'Subject',
      placeholder: 'Who/what with 2-3 visual details (e.g., "elderly historian with trembling hands")',
      color: 'slate',
      examples: ['elderly street musician with weathered hands', 'matte black DJI drone with amber LEDs', 'bengal cat with spotted coat'],
      group: 'core',
    },
    action: {
      icon: Zap,
      label: 'Action',
      placeholder: 'ONE specific action (e.g., "leaping over concrete barriers")',
      color: 'slate',
      examples: ['sprinting through rain-slicked alley', 'dissolving into clear water', 'catching spinning basketball'],
      group: 'core',
    },
    location: {
      icon: MapPin,
      label: 'Location',
      placeholder: 'Specific place with atmosphere (e.g., "neon-lit Tokyo alley at midnight")',
      color: 'slate',
      examples: ['neon-lit Tokyo alley at midnight', 'weathered lighthouse on rocky coast', 'abandoned industrial warehouse with broken windows'],
      group: 'core',
    },
    time: {
      icon: Calendar,
      label: 'Time',
      placeholder: 'Lighting quality (e.g., "golden hour with warm shadows")',
      color: 'slate',
      examples: ['golden hour with warm backlight', 'blue hour dusk with deep shadows', 'harsh midday sun with high contrast'],
      group: 'atmosphere',
    },
    mood: {
      icon: Palette,
      label: 'Mood',
      placeholder: 'Atmosphere with visual cues (e.g., "tense with low-key lighting")',
      color: 'slate',
      examples: ['dramatic with deep shadows', 'serene with soft diffused light', 'energetic with dynamic movement'],
      group: 'atmosphere',
    },
    style: {
      icon: Sparkles,
      label: 'Style',
      placeholder: 'Film stock or aesthetic (NOT "cinematic")',
      color: 'slate',
      examples: ['shot on 35mm film', 'film noir with high-contrast shadows', 'documentary verité handheld'],
      group: 'style',
    },
    event: {
      icon: Lightbulb,
      label: 'Context',
      placeholder: "Event or narrative moment (e.g., \"product reveal moment\")",
      color: 'slate',
      examples: ['product reveal moment', 'celebration with confetti falling', 'demonstration of new technique'],
      group: 'context',
    },
  };

  // Calculate filled count by group
  const filledByGroup = useMemo(() => {
    const result = {};
    Object.entries(ELEMENT_GROUPS).forEach(([groupName, groupElements]) => {
      result[groupName] = groupElements.filter(el => elements[el]).length;
    });
    return result;
  }, [elements]);

  // Check for element compatibility
  const checkCompatibility = useCallback(async (elementType, value) => {
    if (!value) return 1;

    try {
      const response = await fetch('/api/check-compatibility', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'dev-key-12345'
        },
        body: JSON.stringify({
          elementType,
          value,
          existingElements: elements,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.score || 0.5;
      }
    } catch (error) {
      console.error('Error checking compatibility:', error);
    }
    return 0.5;
  }, [elements]);

  // Debounce timers for compatibility checks per element
  const compatibilityTimersRef = useRef({});

  // Detect conflicts between elements
  const detectConflicts = useCallback(() => {
    const newConflicts = [];

    if (elements.location === 'underwater' && elements.action === 'flying') {
      newConflicts.push({
        elements: ['location', 'action'],
        message: 'Flying underwater is physically inconsistent',
        suggestion: 'Consider "swimming" or "floating" instead',
      });
    }

    if (elements.time === 'future' && elements.style === 'vintage') {
      newConflicts.push({
        elements: ['time', 'style'],
        message: 'Future setting with vintage style creates tension',
        suggestion: 'Try "retro-futurism" to blend both concepts',
      });
    }

    setConflicts(newConflicts);
  }, [elements]);

  // Progressive refinement suggestions
  const generateRefinementSuggestions = useCallback(async () => {
    const filledElements = Object.entries(elements).filter(([_, v]) => v);

    if (filledElements.length >= 2) {
      const suggestions = {};
      filledElements.forEach(([key, value]) => {
        if (key === 'action' && elements.location === 'underwater') {
          suggestions[key] = ['swimming gracefully', 'floating weightlessly', 'diving deeper'];
        }
      });
      setRefinementSuggestions(suggestions);
    }
  }, [elements]);

  // Validate prompt completeness and quality
  const validatePrompt = useCallback(() => {
    let score = 0;
    let feedback = [];

    const filledCount = Object.values(elements).filter(v => v).length;
    score += (filledCount / 7) * 30;

    if (conflicts.length === 0) {
      score += 20;
    } else {
      feedback.push('Resolve conflicts for better coherence');
    }

    const specificityScore = Object.values(elements).filter(v => v && v.length > 10).length;
    score += (specificityScore / 7) * 20;

    if (filledByGroup.core === 3) {
      score += 20;
    } else {
      feedback.push(`Fill ${3 - filledByGroup.core} more core elements`);
    }

    if (elements.style && elements.mood) {
      score += 10;
      feedback.push('Good visual definition!');
    }

    setValidationScore({ score: Math.min(100, Math.round(score)), feedback });
  }, [elements, conflicts, filledByGroup]);

  // Auto-suggest dependencies when an element is filled
  const handleElementChange = useCallback(async (key, value) => {
    setElements(prev => ({ ...prev, [key]: value }));

    if (value) {
      const dependentElements = Object.entries(ELEMENT_HIERARCHY)
        .filter(([el, info]) => info.dependencies.includes(key) && !elements[el])
        .map(([el]) => el);

      if (dependentElements.length > 0) {
        console.log(`Consider filling: ${dependentElements.join(', ')}`);
      }
    }

    // Debounce compatibility checks to avoid spamming the API while typing
    if (compatibilityTimersRef.current[key]) {
      clearTimeout(compatibilityTimersRef.current[key]);
    }
    compatibilityTimersRef.current[key] = setTimeout(async () => {
      const score = await checkCompatibility(key, value);
      setCompatibilityScores(prev => ({ ...prev, [key]: score }));
    }, 500);
  }, [elements, checkCompatibility]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(compatibilityTimersRef.current).forEach((t) => clearTimeout(t));
    };
  }, []);

  // Abort controller + cooldown for suggestion fetches
  const suggestionAbortRef = useRef(null);
  const lastSuggestionRef = useRef({ ts: 0, key: '' });

  // Fetch suggestions with context awareness (cooldown + cancel in-flight)
  const fetchSuggestionsForElement = async (elementType) => {
    setIsLoadingSuggestions(true);
    setActiveElement(elementType);
    setNeedsRefresh(false);

    try {
      const context = Object.entries(elements)
        .filter(([key, value]) => value && key !== elementType)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
      const dedupeKey = `${elementType}|${elements[elementType] || ''}|${context}|${concept || ''}`;
      const now = Date.now();
      if (
        lastSuggestionRef.current.key === dedupeKey &&
        now - lastSuggestionRef.current.ts < 800
      ) {
        // Within cooldown and inputs unchanged; skip firing again
        setIsLoadingSuggestions(false);
        return;
      }
      lastSuggestionRef.current = { key: dedupeKey, ts: now };

      if (suggestionAbortRef.current) {
        suggestionAbortRef.current.abort();
      }
      suggestionAbortRef.current = new AbortController();

      const response = await fetch(
        '/api/get-creative-suggestions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': 'dev-key-12345'
          },
          body: JSON.stringify({
            elementType,
            currentValue: elements[elementType],
            context,
            concept,
          }),
          signal: suggestionAbortRef.current.signal,
        }
      );

      if (!response.ok) throw new Error('Failed to fetch suggestions');

      const data = await response.json();
      setSuggestions(data.suggestions || []);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setSuggestions([]);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (suggestionAbortRef.current) suggestionAbortRef.current.abort();
    };
  }, []);

  // Complete the scene
  const completeScene = async () => {
    const emptyElements = Object.entries(elements)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (emptyElements.length === 0) return;

    setIsLoadingSuggestions(true);

    try {
      const response = await fetch(
        '/api/complete-scene',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': 'dev-key-12345'
          },
          body: JSON.stringify({
            existingElements: elements,
            concept,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setElements(prev => ({ ...prev, ...data.suggestions }));
      }
    } catch (error) {
      console.error('Error completing scene:', error);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  // Parse concept into elements
  const parseConceptToElements = async () => {
    if (!concept) return;

    setIsLoadingSuggestions(true);

    try {
      const response = await fetch(
        '/api/parse-concept',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': 'dev-key-12345'
          },
          body: JSON.stringify({ concept }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setElements(data.elements);
        setMode('element');
      }
    } catch (error) {
      console.error('Error parsing concept:', error);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  // Load template
  const loadTemplate = (templateKey) => {
    const template = TEMPLATE_LIBRARY[templateKey];
    if (template) {
      setElements(template.elements);
      setShowTemplates(false);
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion) => {
    if (activeElement) {
      setElementHistory(prev => [...prev, {
        element: activeElement,
        value: suggestion.text,
        timestamp: Date.now(),
      }]);

      handleElementChange(activeElement, suggestion.text);
      setActiveElement(null);
      setSuggestions([]);
    }
  };

  // Generate final template
  const handleGenerateTemplate = (exportFormat = 'detailed') => {
    const filledElements = Object.entries(elements)
      .filter(([_, value]) => value)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');

    const finalConcept = concept || filledElements;
    const technicalParams = generateTechnicalParams(elements);

    onConceptComplete(finalConcept, elements, {
      format: exportFormat,
      technicalParams,
      validationScore: validationScore,
      history: elementHistory,
    });
  };

  // Generate technical parameters
  const generateTechnicalParams = (elements) => {
    const params = {};

    if (elements.time === 'golden hour') {
      params.colorGrading = 'warm tones, soft shadows';
    }
    if (elements.style === 'cinematic') {
      params.aspectRatio = '2.39:1';
      params.frameRate = '24fps';
    }
    if (elements.mood === 'energetic') {
      params.cameraMovement = 'dynamic, handheld';
    }

    return params;
  };

  // Keyboard shortcuts for suggestion selection
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Only handle number keys when suggestions are visible
      if (!activeElement || suggestions.length === 0) return;

      const key = parseInt(e.key);
      if (key >= 1 && key <= Math.min(suggestions.length, 8)) {
        e.preventDefault();
        const suggestion = suggestions[key - 1];
        if (suggestion) {
          handleSuggestionClick(suggestion);
        }
      }

      // Escape to close suggestions
      if (e.key === 'Escape' && activeElement) {
        setActiveElement(null);
        setSuggestions([]);
      }

      // R to refresh suggestions
      if (e.key === 'r' && activeElement && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        fetchSuggestionsForElement(activeElement);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [activeElement, suggestions, fetchSuggestionsForElement]);

  // Effects
  useEffect(() => {
    detectConflicts();
  }, [elements, detectConflicts]);

  useEffect(() => {
    validatePrompt();
  }, [elements, validatePrompt]);

  useEffect(() => {
    generateRefinementSuggestions();
  }, [elements, generateRefinementSuggestions]);

  const filledCount = Object.values(elements).filter((v) => v).length;
  const isReadyToGenerate = filledCount >= 3;

  return (
    <div className="min-h-screen bg-neutral-50 flex">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Professional Header */}
        <div className="bg-white border-b border-neutral-200">
          <div className="mx-auto max-w-7xl px-6 py-8">
            <div>
              <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight">
                Video Concept Builder
              </h1>
              <p className="mt-1 text-sm text-neutral-600">
                Build professional video prompts with AI-guided suggestions
              </p>
              {/* Video Prompt Principles Banner - 2025 Design */}
              <div className="mt-4 relative overflow-hidden rounded-xl border border-neutral-200/60 bg-gradient-to-br from-neutral-50 via-white to-neutral-50/50 shadow-sm">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-violet-100/20 via-transparent to-transparent" />
                <div className="relative px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="p-1.5 rounded-lg bg-violet-500/10 ring-1 ring-violet-500/20">
                        <Info className="h-3.5 w-3.5 text-violet-700" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-semibold text-neutral-900 tracking-tight mb-1">
                        Video Prompt Best Practices
                      </h4>
                      <p className="text-xs leading-relaxed text-neutral-600">
                        Be specific with 2-3 visual details • Use ONE clear action • Avoid generic terms like "cinematic" • Describe what the camera sees
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="mt-6 flex items-center gap-2">
              {/* Mode Toggle - Segmented Control */}
              <div className="inline-flex items-center bg-neutral-100 rounded-lg p-1">
                <button
                  onClick={() => setMode('element')}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                    mode === 'element'
                      ? 'bg-white text-neutral-900 shadow-sm'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  <Sparkles className="h-4 w-4" />
                  Element Builder
                </button>
                <button
                  onClick={() => setMode('concept')}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                    mode === 'concept'
                      ? 'bg-white text-neutral-900 shadow-sm'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  <Brain className="h-4 w-4" />
                  Describe Concept
                </button>
              </div>

              {/* Divider */}
              <div className="w-px h-6 bg-neutral-200" />

              {/* Secondary Actions - Ghost Buttons */}
              <button
                onClick={() => setShowTemplates(!showTemplates)}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors"
              >
                <BookOpen className="h-4 w-4" />
                Templates
              </button>

              <button
                onClick={completeScene}
                disabled={filledCount === 0}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Wand2 className="h-4 w-4" />
                Auto-complete
              </button>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Primary Action */}
              <button
                onClick={() => handleGenerateTemplate('detailed')}
                disabled={!isReadyToGenerate}
                className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-semibold text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                title={isReadyToGenerate ? 'Generate optimized prompt' : 'Fill at least 3 elements to continue'}
              >
                Generate Prompt
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Templates Panel */}
        {showTemplates && (
          <div className="mb-6 p-6 bg-white border border-neutral-200 rounded-xl">
            <h3 className="text-sm font-semibold text-neutral-900 mb-4">Quick Start Templates</h3>
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(TEMPLATE_LIBRARY).map(([key, template]) => (
                <button
                  key={key}
                  onClick={() => loadTemplate(key)}
                  className="p-4 text-left bg-neutral-50 border border-neutral-200 rounded-lg hover:bg-neutral-100 hover:border-neutral-300 transition-colors"
                >
                  <div className="text-sm font-medium text-neutral-900">{template.name}</div>
                  <div className="mt-1 text-xs text-neutral-600 line-clamp-1">
                    {Object.values(template.elements).slice(0, 2).join(' • ')}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Video Prompt Guidance Panel - 2025 Design */}
        <div className="mb-6">
          <button
            onClick={() => setShowGuidance(!showGuidance)}
            className="group w-full relative overflow-hidden rounded-xl border border-neutral-200/60 bg-white shadow-sm hover:shadow-md transition-all duration-300 hover:border-neutral-300"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500/10 to-teal-500/10 ring-1 ring-emerald-500/20 group-hover:ring-emerald-500/30 transition-all">
                  <Lightbulb className="h-3.5 w-3.5 text-emerald-700" />
                </div>
                <span className="text-sm font-semibold text-neutral-900 tracking-tight">
                  Video Prompt Writing Guide
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-neutral-500">
                  {showGuidance ? 'Hide' : 'Show examples'}
                </span>
                <div className={`transition-transform duration-300 ${showGuidance ? 'rotate-180' : ''}`}>
                  <svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          </button>

          {showGuidance && (
            <div className="mt-2 rounded-xl border border-neutral-200/60 bg-white shadow-sm overflow-hidden animate-[slideDown_0.3s_ease-out]">
              <div className="p-6 space-y-5">
                {/* Subject Examples */}
                <div className="group/section">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-5 w-0.5 rounded-full bg-gradient-to-b from-violet-500 to-violet-300" />
                    <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">Subject</h4>
                  </div>
                  <div className="space-y-2.5 pl-3.5">
                    <div className="flex items-start gap-3 p-2.5 rounded-lg bg-red-50/50 border border-red-100/50">
                      <div className="flex-shrink-0 mt-0.5">
                        <div className="h-4 w-4 rounded-full bg-red-100 flex items-center justify-center">
                          <X className="h-2.5 w-2.5 text-red-600" />
                        </div>
                      </div>
                      <span className="text-xs text-neutral-700 leading-relaxed">"a person" or "a nice car"</span>
                    </div>
                    <div className="flex items-start gap-3 p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-100/50">
                      <div className="flex-shrink-0 mt-0.5">
                        <div className="h-4 w-4 rounded-full bg-emerald-100 flex items-center justify-center">
                          <CheckCircle className="h-2.5 w-2.5 text-emerald-600" />
                        </div>
                      </div>
                      <span className="text-xs text-neutral-700 leading-relaxed">"elderly street musician with weathered hands and silver harmonica"</span>
                    </div>
                  </div>
                </div>

                {/* Action Examples */}
                <div className="group/section pt-1">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-5 w-0.5 rounded-full bg-gradient-to-b from-blue-500 to-blue-300" />
                    <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">Action</h4>
                    <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">ONE ONLY</span>
                  </div>
                  <div className="space-y-2.5 pl-3.5">
                    <div className="flex items-start gap-3 p-2.5 rounded-lg bg-red-50/50 border border-red-100/50">
                      <div className="flex-shrink-0 mt-0.5">
                        <div className="h-4 w-4 rounded-full bg-red-100 flex items-center justify-center">
                          <X className="h-2.5 w-2.5 text-red-600" />
                        </div>
                      </div>
                      <span className="text-xs text-neutral-700 leading-relaxed">"running, jumping, and spinning" <span className="text-neutral-500">(multiple actions degrade quality)</span></span>
                    </div>
                    <div className="flex items-start gap-3 p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-100/50">
                      <div className="flex-shrink-0 mt-0.5">
                        <div className="h-4 w-4 rounded-full bg-emerald-100 flex items-center justify-center">
                          <CheckCircle className="h-2.5 w-2.5 text-emerald-600" />
                        </div>
                      </div>
                      <span className="text-xs text-neutral-700 leading-relaxed">"leaping over concrete barriers in slow motion"</span>
                    </div>
                  </div>
                </div>

                {/* Style Examples */}
                <div className="group/section pt-1">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-5 w-0.5 rounded-full bg-gradient-to-b from-amber-500 to-amber-300" />
                    <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">Style</h4>
                    <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">USE TECHNICAL TERMS</span>
                  </div>
                  <div className="space-y-2.5 pl-3.5">
                    <div className="flex items-start gap-3 p-2.5 rounded-lg bg-red-50/50 border border-red-100/50">
                      <div className="flex-shrink-0 mt-0.5">
                        <div className="h-4 w-4 rounded-full bg-red-100 flex items-center justify-center">
                          <X className="h-2.5 w-2.5 text-red-600" />
                        </div>
                      </div>
                      <span className="text-xs text-neutral-700 leading-relaxed">"cinematic" or "artistic" or "moody"</span>
                    </div>
                    <div className="flex items-start gap-3 p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-100/50">
                      <div className="flex-shrink-0 mt-0.5">
                        <div className="h-4 w-4 rounded-full bg-emerald-100 flex items-center justify-center">
                          <CheckCircle className="h-2.5 w-2.5 text-emerald-600" />
                        </div>
                      </div>
                      <span className="text-xs text-neutral-700 leading-relaxed">"shot on 35mm film with shallow depth of field" or "film noir aesthetic with Rembrandt lighting"</span>
                    </div>
                  </div>
                </div>

                {/* Key Principle - Modern Card */}
                <div className="pt-2">
                  <div className="relative overflow-hidden rounded-xl border border-neutral-200/60 bg-gradient-to-br from-neutral-50 via-white to-neutral-50/50">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-blue-100/20 via-transparent to-transparent" />
                    <div className="relative px-4 py-3.5">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          <div className="p-1.5 rounded-lg bg-blue-500/10 ring-1 ring-blue-500/20">
                            <Sparkles className="h-3.5 w-3.5 text-blue-700" />
                          </div>
                        </div>
                        <p className="text-xs leading-relaxed text-neutral-700">
                          <span className="font-semibold text-neutral-900">Remember:</span> Describe only what the camera can SEE. Translate emotions into visible actions and environmental details.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Concept Mode */}
        {mode === 'concept' && (
          <div className="mb-8 mx-auto max-w-3xl">
            <div className="p-8 bg-white border border-neutral-200 rounded-xl">
              <label className="block text-sm font-medium text-neutral-900 mb-3">
                Describe your video concept
              </label>
              <textarea
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                placeholder="Example: A sleek sports car drifting through a neon-lit Tokyo street at night, cinematic style with dramatic lighting..."
                className="w-full h-32 px-4 py-3 text-sm text-neutral-900 bg-neutral-50 border border-neutral-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              />
              <div className="mt-4 flex justify-center">
                <button
                  onClick={parseConceptToElements}
                  disabled={!concept}
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Brain className="h-4 w-4" />
                  Parse into Elements
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Conflicts Alert */}
        {conflicts.length > 0 && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-amber-900 mb-2">
                  Potential Conflicts Detected
                </h3>
                {conflicts.map((conflict, idx) => (
                  <div key={idx} className="text-sm text-amber-800 mt-2">
                    <div>{conflict.message}</div>
                    <div className="mt-1 text-xs text-amber-700">{conflict.suggestion}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Bento Grid - Element Cards */}
        {mode === 'element' && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(elements).map(([key]) => {
              const config = elementConfig[key];
              const Icon = config.icon;
              const isActive = activeElement === key;
              const isFilled = elements[key];
              const compatibility = compatibilityScores[key];

              return (
                <div
                  key={key}
                  className={`p-5 bg-white border rounded-xl transition-all ${
                    isActive
                      ? 'border-neutral-900 shadow-md'
                      : isFilled
                        ? 'border-neutral-300'
                        : 'border-neutral-200'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-neutral-100 rounded-lg">
                      <Icon className="h-4 w-4 text-neutral-700" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-neutral-900">{config.label}</h3>
                    </div>
                    {/* AI Button - Consistent Position */}
                    <button
                      onClick={() => fetchSuggestionsForElement(key)}
                      className="group relative overflow-hidden px-2.5 py-1 text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 active:scale-95"
                      title="Get AI suggestions"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                      <div className="relative flex items-center gap-1.5">
                        <Sparkles className="h-3 w-3" />
                        <span>AI</span>
                      </div>
                    </button>
                    {isFilled && compatibility !== undefined && (
                      <div className="flex items-center gap-1">
                        {compatibility >= 0.8 ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : compatibility < 0.6 ? (
                          <AlertCircle className="h-4 w-4 text-red-600" />
                        ) : null}
                      </div>
                    )}
                  </div>

                  {/* Input Field */}
                  <input
                    type="text"
                    value={elements[key]}
                    onChange={(e) => handleElementChange(key, e.target.value)}
                    onFocus={() => {
                      if (suggestions.length === 0 || activeElement !== key) {
                        fetchSuggestionsForElement(key);
                      }
                    }}
                    placeholder={config.placeholder}
                    className="w-full px-3 py-2 text-sm text-neutral-900 bg-neutral-50 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                  />

                  {/* Quick Examples - 2025 Design */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {config.examples.map((example, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleElementChange(key, example)}
                        className="px-2.5 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:border-neutral-300 hover:shadow-sm hover:bg-neutral-50 transition-all duration-200 active:scale-95"
                      >
                        {example}
                      </button>
                    ))}
                  </div>

                </div>
              );
            })}
          </div>
        )}

        </div>
      </div>

      {/* Right Side AI Suggestions Panel - 2025 Redesign */}
      <div className="w-80 bg-white border-l border-neutral-200 flex flex-col h-screen sticky top-0 shadow-sm">
        {/* Modern Panel Header with Glassmorphism Accent */}
        <div className="flex-shrink-0 px-4 py-3.5 border-b border-neutral-200 bg-gradient-to-b from-neutral-50/50 to-white backdrop-blur-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="p-1.5 bg-gradient-to-br from-neutral-100 to-neutral-50 rounded-lg shadow-sm ring-1 ring-neutral-200/50">
                <Sparkles className="h-3.5 w-3.5 text-neutral-700" />
              </div>
              <h3 className="text-[13px] font-semibold text-neutral-900 tracking-tight">
                AI Suggestions
              </h3>
            </div>

            {/* Header Actions */}
            {activeElement && (
              <button
                onClick={() => fetchSuggestionsForElement(activeElement)}
                className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-all duration-150 active:scale-95"
                title="Refresh suggestions"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Active Element Indicator with Modern Badge */}
          {activeElement && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider">
                For:
              </span>
              <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-neutral-900 text-white rounded-md shadow-sm">
                {React.createElement(elementConfig[activeElement].icon, {
                  className: "h-3 w-3"
                })}
                <span className="text-[12px] font-medium">
                  {elementConfig[activeElement].label}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Panel Content with Modern Scrolling */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {isLoadingSuggestions ? (
            /* Adaptive Skeleton Loader - matches suggestion count and type */
            <div className="p-4 space-y-3">
              {Array.from({ length: activeElement ? (
                // Adaptive count based on element type
                ['subject', 'action'].includes(activeElement) ? 6 : // Core elements get more suggestions
                ['location', 'time'].includes(activeElement) ? 5 :
                ['mood', 'style'].includes(activeElement) ? 5 :
                4 // event and other elements
              ) : 4 }).map((_, i) => (
                <div
                  key={i}
                  className="relative overflow-hidden p-4 bg-gradient-to-r from-neutral-100 via-neutral-50 to-neutral-100 border border-neutral-200 rounded-xl animate-pulse"
                  style={{
                    animationDelay: `${i * 75}ms`,
                    animationDuration: '1.5s'
                  }}
                >
                  {/* Shimmer effect */}
                  <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />

                  <div className="relative space-y-2.5">
                    <div className="flex items-center justify-between gap-3">
                      {/* Vary skeleton width for more natural look */}
                      <div className={`h-4 bg-neutral-200/70 rounded-md ${
                        i % 3 === 0 ? 'w-3/4' : i % 3 === 1 ? 'w-2/3' : 'w-4/5'
                      }`} />
                      {/* Show compatibility indicator skeleton */}
                      {elements[activeElement] && (
                        <div className="h-5 bg-neutral-200/70 rounded-full w-12" />
                      )}
                    </div>
                    {/* Vary explanation lines for natural appearance */}
                    <div className={`h-3 bg-neutral-200/50 rounded-md ${
                      i % 2 === 0 ? 'w-full' : 'w-11/12'
                    }`} />
                    {i % 3 !== 2 && (
                      <div className={`h-3 bg-neutral-200/50 rounded-md ${
                        i % 2 === 0 ? 'w-5/6' : 'w-4/5'
                      }`} />
                    )}
                  </div>
                </div>
              ))}
              <p className="text-center text-[13px] text-neutral-500 font-medium mt-6">
                {activeElement ? `Finding ${elementConfig[activeElement]?.label.toLowerCase()} suggestions...` : 'Finding perfect suggestions...'}
              </p>
            </div>
          ) : activeElement && suggestions.length > 0 ? (
            /* Modern Suggestion Cards with Stagger Animation */
            <div className="p-4 space-y-3">
              {suggestions.map((suggestion, idx) => (
                <div
                  key={idx}
                  className="group relative animate-[slideIn_0.3s_ease-out_forwards] opacity-0"
                  style={{
                    animationDelay: `${idx * 50}ms`
                  }}
                >
                  <button
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="w-full p-3.5 text-left bg-white border border-neutral-200 rounded-xl hover:border-neutral-300 hover:shadow-md transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400 active:scale-[0.98]"
                  >
                    {/* Keyboard Shortcut Indicator */}
                    {idx < 8 && (
                      <kbd className="absolute top-2.5 right-2.5 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-400 bg-neutral-100 border border-neutral-200 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        {idx + 1}
                      </kbd>
                    )}

                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="text-[14px] font-semibold text-neutral-900 leading-snug flex-1 pr-6">
                        {suggestion.text}
                      </div>

                      {/* Modern Compatibility Score */}
                      {suggestion.compatibility && (
                        <div className="flex-shrink-0 flex items-center gap-1.5">
                          <div className={`h-1.5 w-1.5 rounded-full shadow-sm ${
                            suggestion.compatibility >= 0.8
                              ? 'bg-emerald-500'
                              : suggestion.compatibility >= 0.6
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`} />
                          <span className={`text-[11px] font-bold tracking-tight ${
                            suggestion.compatibility >= 0.8
                              ? 'text-emerald-700'
                              : suggestion.compatibility >= 0.6
                              ? 'text-amber-700'
                              : 'text-rose-700'
                          }`}>
                            {Math.round(suggestion.compatibility * 100)}%
                          </span>
                        </div>
                      )}
                    </div>

                    {suggestion.explanation && (
                      <div className="text-[12px] text-neutral-600 leading-relaxed line-clamp-2">
                        {suggestion.explanation}
                      </div>
                    )}

                    {/* Hover Action Bar */}
                    <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(suggestion.text);
                        }}
                        className="text-[11px] font-medium text-neutral-600 hover:text-neutral-900 transition-colors duration-150 cursor-pointer"
                      >
                        Copy
                      </span>
                      <span className="text-neutral-300">•</span>
                      <span className="text-[11px] text-neutral-500">
                        Click to apply
                      </span>
                    </div>
                  </button>
                </div>
              ))}

              {/* Bottom Helper Text */}
              <div className="pt-2 pb-1 text-center">
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  Use number keys 1-{Math.min(suggestions.length, 8)} for quick selection
                </p>
              </div>
            </div>
          ) : (
            /* Modern Empty State with Progressive Onboarding */
            <div className="flex flex-1 items-center justify-center p-6">
              <div className="text-center max-w-[240px]">
                <div className="relative inline-flex mb-4">
                  <div className="absolute inset-0 bg-neutral-200/50 rounded-full blur-xl animate-pulse" />
                  <div className="relative p-3 bg-gradient-to-br from-neutral-100 to-neutral-50 rounded-2xl shadow-sm ring-1 ring-neutral-200/50">
                    <Sparkles className="h-8 w-8 text-neutral-400" />
                  </div>
                </div>

                <h4 className="text-[14px] font-semibold text-neutral-900 mb-2">
                  Ready to inspire
                </h4>
                <p className="text-[12px] text-neutral-600 leading-relaxed mb-4">
                  Click any element card to get AI-powered suggestions tailored to your concept
                </p>

                {/* Quick Tips */}
                <div className="space-y-2 text-left">
                  <div className="flex items-start gap-2 p-2 bg-neutral-50 rounded-lg border border-neutral-200/50">
                    <Info className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0 mt-0.5" />
                    <span className="text-[11px] text-neutral-600 leading-relaxed">
                      Suggestions adapt based on your filled elements
                    </span>
                  </div>
                  <div className="flex items-start gap-2 p-2 bg-neutral-50 rounded-lg border border-neutral-200/50">
                    <Zap className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0 mt-0.5" />
                    <span className="text-[11px] text-neutral-600 leading-relaxed">
                      Use keyboard shortcuts for faster workflow
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modern Footer with Context Info */}
        {activeElement && suggestions.length > 0 && (
          <div className="flex-shrink-0 px-4 py-3 border-t border-neutral-200 bg-neutral-50/50">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-neutral-600 font-medium">
                {suggestions.length} suggestions
              </span>
              <div className="flex items-center gap-1.5 text-neutral-500">
                <CheckCircle className="h-3 w-3" />
                <span>Context-aware</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Custom CSS for Animations */}
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }

        /* Smooth scrolling behavior */
        * {
          scroll-behavior: smooth;
        }

        /* Custom focus rings for 2025 design */
        button:focus-visible,
        input:focus-visible {
          outline: 2px solid rgb(99 102 241);
          outline-offset: 2px;
        }
      `}</style>
    </div>
  );
}
