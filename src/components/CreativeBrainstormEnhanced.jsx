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
      subject: 'sleek tech product',
      action: 'rotating slowly',
      location: 'minimalist studio',
      time: 'soft even lighting',
      mood: 'professional and clean',
      style: 'commercial photography',
      event: 'product reveal',
    },
  },
  natureScene: {
    name: 'Nature Doc',
    elements: {
      subject: 'wild animals',
      action: 'hunting or foraging',
      location: 'natural habitat',
      time: 'golden hour',
      mood: 'majestic and raw',
      style: 'documentary realism',
      event: 'wildlife behavior',
    },
  },
  urbanAction: {
    name: 'Urban Action',
    elements: {
      subject: 'parkour athlete',
      action: 'vaulting and running',
      location: 'city rooftops',
      time: 'blue hour dusk',
      mood: 'energetic and intense',
      style: 'cinematic action',
      event: 'chase sequence',
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

  const previousElementsRef = useRef(elements);

  const elementConfig = {
    subject: {
      icon: User,
      label: 'Subject',
      placeholder: 'Who or what is the main focus?',
      color: 'slate',
      examples: ['person', 'product', 'animal'],
      group: 'core',
    },
    action: {
      icon: Zap,
      label: 'Action',
      placeholder: 'What is happening?',
      color: 'slate',
      examples: ['walking', 'floating', 'exploding'],
      group: 'core',
    },
    location: {
      icon: MapPin,
      label: 'Location',
      placeholder: 'Where does this take place?',
      color: 'slate',
      examples: ['urban street', 'mountain peak', 'underwater'],
      group: 'core',
    },
    time: {
      icon: Calendar,
      label: 'Time',
      placeholder: 'When does this happen?',
      color: 'slate',
      examples: ['golden hour', 'midnight', 'future'],
      group: 'atmosphere',
    },
    mood: {
      icon: Palette,
      label: 'Mood',
      placeholder: 'What feeling should it evoke?',
      color: 'slate',
      examples: ['dramatic', 'peaceful', 'energetic'],
      group: 'atmosphere',
    },
    style: {
      icon: Sparkles,
      label: 'Style',
      placeholder: 'What artistic style?',
      color: 'slate',
      examples: ['cinematic', 'documentary', 'anime'],
      group: 'style',
    },
    event: {
      icon: Lightbulb,
      label: 'Context',
      placeholder: "What's the occasion?",
      color: 'slate',
      examples: ['product launch', 'celebration', 'demonstration'],
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
      const response = await fetch('http://localhost:3001/api/check-compatibility', {
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

    const score = await checkCompatibility(key, value);
    setCompatibilityScores(prev => ({ ...prev, [key]: score }));
  }, [elements, checkCompatibility]);

  // Fetch suggestions with context awareness
  const fetchSuggestionsForElement = async (elementType) => {
    setIsLoadingSuggestions(true);
    setActiveElement(elementType);
    setNeedsRefresh(false);

    try {
      const context = Object.entries(elements)
        .filter(([key, value]) => value && key !== elementType)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');

      const response = await fetch(
        'http://localhost:3001/api/get-creative-suggestions',
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

  // Complete the scene
  const completeScene = async () => {
    const emptyElements = Object.entries(elements)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (emptyElements.length === 0) return;

    setIsLoadingSuggestions(true);

    try {
      const response = await fetch(
        'http://localhost:3001/api/complete-scene',
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
        'http://localhost:3001/api/parse-concept',
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

                  {/* Quick Examples */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {config.examples.map((example, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleElementChange(key, example)}
                        className="px-2.5 py-1 text-xs font-medium text-neutral-700 bg-neutral-100 rounded-md hover:bg-neutral-200 transition-colors"
                      >
                        {example}
                      </button>
                    ))}
                    <button
                      onClick={() => fetchSuggestionsForElement(key)}
                      className="px-2.5 py-1 text-xs font-medium text-neutral-900 bg-neutral-200 rounded-md hover:bg-neutral-300 transition-colors inline-flex items-center gap-1"
                    >
                      <Sparkles className="h-3 w-3" />
                      AI
                    </button>
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
            /* Modern Skeleton Loader with Shimmer Effect */
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4].map((i) => (
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
                      <div className="h-4 bg-neutral-200/70 rounded-md w-3/4" />
                      <div className="h-5 bg-neutral-200/70 rounded-full w-12" />
                    </div>
                    <div className="h-3 bg-neutral-200/50 rounded-md w-full" />
                    <div className="h-3 bg-neutral-200/50 rounded-md w-5/6" />
                  </div>
                </div>
              ))}
              <p className="text-center text-[13px] text-neutral-500 font-medium mt-6">
                Finding perfect suggestions...
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
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(suggestion.text);
                        }}
                        className="text-[11px] font-medium text-neutral-600 hover:text-neutral-900 transition-colors duration-150"
                      >
                        Copy
                      </button>
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

        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}
