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
  Eye,
  Save,
  FileText,
  Shuffle,
  ChevronRight,
  ChevronLeft,
  Target,
  Film,
  Settings,
  Layers,
  TrendingUp,
  AlertTriangle,
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
    name: 'Product Demonstration',
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
    name: 'Nature Documentary',
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
  const [mode, setMode] = useState('element'); // 'concept' or 'element'
  const [phase, setPhase] = useState('concept'); // 'concept', 'enhancement', 'polish'
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
      label: 'Subject/Character',
      placeholder: 'Who or what is the main focus?',
      color: 'blue',
      examples: ['person', 'product', 'animal', 'vehicle', 'object'],
      group: 'core',
      description: 'The main focus of your video',
    },
    action: {
      icon: Zap,
      label: 'Action/Activity',
      placeholder: 'What is happening?',
      color: 'purple',
      examples: ['walking', 'floating', 'exploding', 'transforming', 'dancing'],
      group: 'core',
      description: 'The primary movement or activity',
    },
    location: {
      icon: MapPin,
      label: 'Location/Setting',
      placeholder: 'Where does this take place?',
      color: 'green',
      examples: ['urban street', 'mountain peak', 'underwater', 'space', 'studio'],
      group: 'core',
      description: 'The environment or backdrop',
    },
    time: {
      icon: Calendar,
      label: 'Time/Period',
      placeholder: 'When does this happen?',
      color: 'orange',
      examples: ['golden hour', 'midnight', 'future', 'past', 'present'],
      group: 'atmosphere',
      description: 'Time of day or era',
    },
    mood: {
      icon: Palette,
      label: 'Mood/Atmosphere',
      placeholder: 'What feeling should it evoke?',
      color: 'pink',
      examples: ['dramatic', 'peaceful', 'energetic', 'mysterious', 'romantic'],
      group: 'atmosphere',
      description: 'The emotional tone',
    },
    style: {
      icon: Sparkles,
      label: 'Visual Style',
      placeholder: 'What artistic style?',
      color: 'indigo',
      examples: ['cinematic', 'documentary', 'anime', 'abstract', 'vintage'],
      group: 'style',
      description: 'The visual treatment',
    },
    event: {
      icon: Lightbulb,
      label: 'Event/Context',
      placeholder: "What's the occasion or context?",
      color: 'yellow',
      examples: ['product launch', 'celebration', 'demonstration', 'transformation', 'reveal'],
      group: 'context',
      description: 'The narrative context',
    },
  };

  const colorClasses = {
    blue: 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100',
    purple: 'bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100',
    green: 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100',
    orange: 'bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100',
    pink: 'bg-pink-50 border-pink-300 text-pink-700 hover:bg-pink-100',
    indigo: 'bg-indigo-50 border-indigo-300 text-indigo-700 hover:bg-indigo-100',
    yellow: 'bg-yellow-50 border-yellow-300 text-yellow-700 hover:bg-yellow-100',
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

    // Check for logical conflicts
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
      // Simulate API call for refinement suggestions
      const suggestions = {};
      filledElements.forEach(([key, value]) => {
        // Generate contextual refinements based on other elements
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

    // Check element completeness
    const filledCount = Object.values(elements).filter(v => v).length;
    score += (filledCount / 7) * 30; // 30 points for completeness

    // Check coherence (no conflicts)
    if (conflicts.length === 0) {
      score += 20;
    } else {
      feedback.push('Resolve conflicts for better coherence');
    }

    // Check specificity
    const specificityScore = Object.values(elements).filter(v => v && v.length > 10).length;
    score += (specificityScore / 7) * 20; // 20 points for specificity

    // Check core elements
    if (filledByGroup.core === 3) {
      score += 20;
    } else {
      feedback.push(`Fill ${3 - filledByGroup.core} more core elements`);
    }

    // Visual potential bonus
    if (elements.style && elements.mood) {
      score += 10;
      feedback.push('Good visual definition!');
    }

    setValidationScore({ score: Math.min(100, Math.round(score)), feedback });
  }, [elements, conflicts, filledByGroup]);

  // Auto-suggest dependencies when an element is filled
  const handleElementChange = useCallback(async (key, value) => {
    setElements(prev => ({ ...prev, [key]: value }));

    // Check for dependencies that should be auto-suggested
    if (value) {
      const dependentElements = Object.entries(ELEMENT_HIERARCHY)
        .filter(([el, info]) => info.dependencies.includes(key) && !elements[el])
        .map(([el]) => el);

      if (dependentElements.length > 0) {
        // Would trigger smart suggestions for dependent elements
        console.log(`Consider filling: ${dependentElements.join(', ')}`);
      }
    }

    // Check compatibility
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

  // Complete the scene - suggest all remaining elements
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

  // Generate variations of current setup
  const generateVariations = async () => {
    setIsLoadingSuggestions(true);

    try {
      const response = await fetch(
        'http://localhost:3001/api/generate-variations',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': 'dev-key-12345'
          },
          body: JSON.stringify({
            elements,
            concept,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Handle variations display
        console.log('Variations:', data.variations);
      }
    } catch (error) {
      console.error('Error generating variations:', error);
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

  // Handle suggestion click with history tracking
  const handleSuggestionClick = (suggestion) => {
    if (activeElement) {
      // Track history for learning
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

  // Generate final template with options
  const handleGenerateTemplate = (exportFormat = 'detailed') => {
    const filledElements = Object.entries(elements)
      .filter(([_, value]) => value)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');

    const finalConcept = concept || filledElements;

    // Add technical parameters based on elements
    const technicalParams = generateTechnicalParams(elements);

    onConceptComplete(finalConcept, elements, {
      format: exportFormat,
      technicalParams,
      validationScore: validationScore,
      history: elementHistory,
    });
  };

  // Generate technical parameters based on elements
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
    <div className="mx-auto w-full max-w-6xl relative pb-24">
      {/* Header with mode toggle */}
      <div className="mb-8">
        <div className="mb-4 text-center">
          <h2 className="mb-2 text-3xl font-bold text-gray-900">
            Advanced Concept Builder
          </h2>
          <p className="text-gray-600">
            Build your video concept with intelligent guidance and suggestions
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="flex justify-center gap-4 mb-6">
          <button
            onClick={() => setMode('concept')}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${
              mode === 'concept'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <Brain className="inline h-4 w-4 mr-2" />
            Concept First
          </button>
          <button
            onClick={() => setMode('element')}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${
              mode === 'element'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <Layers className="inline h-4 w-4 mr-2" />
            Element Builder
          </button>
        </div>

        {/* Phase Indicator */}
        <div className="flex justify-center items-center gap-4 mb-6">
          <button
            onClick={() => setPhase('concept')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
              phase === 'concept' ? 'bg-blue-100 text-blue-700' : 'text-gray-600'
            }`}
          >
            <span className={`w-8 h-8 rounded-full flex items-center justify-center ${
              phase === 'concept' ? 'bg-blue-600 text-white' : 'bg-gray-300'
            }`}>1</span>
            Concept
          </button>
          <ChevronRight className="text-gray-400" />
          <button
            onClick={() => setPhase('enhancement')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
              phase === 'enhancement' ? 'bg-blue-100 text-blue-700' : 'text-gray-600'
            }`}
          >
            <span className={`w-8 h-8 rounded-full flex items-center justify-center ${
              phase === 'enhancement' ? 'bg-blue-600 text-white' : 'bg-gray-300'
            }`}>2</span>
            Enhancement
          </button>
          <ChevronRight className="text-gray-400" />
          <button
            onClick={() => setPhase('polish')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
              phase === 'polish' ? 'bg-blue-100 text-blue-700' : 'text-gray-600'
            }`}
          >
            <span className={`w-8 h-8 rounded-full flex items-center justify-center ${
              phase === 'polish' ? 'bg-blue-600 text-white' : 'bg-gray-300'
            }`}>3</span>
            Polish
          </button>
        </div>
      </div>

      {/* Quality Score and Utility Buttons */}
      <div className="mb-4 flex justify-between items-center gap-4">
        {/* Compact Quality Score Badge */}
        {validationScore && (
          <div className="flex items-center gap-3 px-4 py-2 border border-blue-200 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">Quality Score</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-xl font-bold text-blue-600">
                {validationScore.score}%
              </div>
              {validationScore.score >= 80 && <CheckCircle className="h-4 w-4 text-green-600" />}
              {validationScore.score < 60 && <AlertCircle className="h-4 w-4 text-orange-600" />}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center gap-2"
          >
            <BookOpen className="h-4 w-4" />
            Templates
          </button>
          <button
            onClick={completeScene}
            disabled={filledCount === 0}
            className="px-4 py-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 flex items-center gap-2 disabled:opacity-50"
          >
            <Wand2 className="h-4 w-4" />
            Complete Scene
          </button>
          <button
            onClick={generateVariations}
            disabled={filledCount < 3}
            className="px-4 py-2 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 flex items-center gap-2 disabled:opacity-50"
          >
            <Shuffle className="h-4 w-4" />
            Generate Variations
          </button>
        </div>
      </div>

      {/* Templates Panel */}
      {showTemplates && (
        <div className="mb-6 p-4 border-2 border-blue-200 rounded-xl bg-white">
          <h3 className="font-semibold mb-3">Quick Start Templates</h3>
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(TEMPLATE_LIBRARY).map(([key, template]) => (
              <button
                key={key}
                onClick={() => loadTemplate(key)}
                className="p-3 text-left border rounded-lg hover:bg-blue-50 hover:border-blue-300"
              >
                <div className="font-medium">{template.name}</div>
                <div className="text-xs text-gray-600 mt-1">
                  {Object.values(template.elements).slice(0, 3).join(', ')}...
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Concept Mode */}
      {mode === 'concept' && (
        <div className="mb-8 mx-auto max-w-2xl rounded-xl border-2 border-gray-200 bg-white p-6 shadow-md">
          <label className="mb-2 block text-sm font-semibold text-gray-700 text-center">
            Describe Your Concept
          </label>
          <textarea
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            placeholder="Describe your video idea in detail. AI will break it down into elements..."
            className="w-full resize-none rounded-lg border-2 border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none"
            rows={3}
          />
          <div className="flex justify-center">
            <button
              onClick={parseConceptToElements}
              disabled={!concept}
              className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Brain className="inline h-4 w-4 mr-2" />
              Parse Into Elements
            </button>
          </div>
        </div>
      )}

      {/* Conflicts Alert */}
      {conflicts.length > 0 && (
        <div className="mb-6 p-4 border-2 border-yellow-200 bg-yellow-50 rounded-xl">
          <h3 className="font-semibold text-yellow-800 mb-2 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Potential Conflicts Detected
          </h3>
          {conflicts.map((conflict, idx) => (
            <div key={idx} className="mb-2">
              <div className="text-sm text-yellow-700">{conflict.message}</div>
              <div className="text-xs text-yellow-600 mt-1">
                💡 {conflict.suggestion}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Element Groups */}
      {Object.entries(ELEMENT_GROUPS).map(([groupName, groupElements]) => (
        <div key={groupName} className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold capitalize text-gray-800">
              {groupName === 'core' && <Target className="inline h-5 w-5 mr-2 text-blue-600" />}
              {groupName === 'atmosphere' && <Palette className="inline h-5 w-5 mr-2 text-pink-600" />}
              {groupName === 'style' && <Film className="inline h-5 w-5 mr-2 text-indigo-600" />}
              {groupName === 'context' && <Settings className="inline h-5 w-5 mr-2 text-yellow-600" />}
              {groupName} Elements
            </h3>
            <span className="text-sm text-gray-600">
              {filledByGroup[groupName]} / {groupElements.length} filled
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {groupElements.map((key) => {
              const config = elementConfig[key];
              const Icon = config.icon;
              const isActive = activeElement === key;
              const isFilled = elements[key];
              const compatibility = compatibilityScores[key];
              const hasRefinements = refinementSuggestions[key];
              const isLocked = false; // All elements should be editable

              return (
                <div
                  key={key}
                  className={`relative rounded-xl border-2 bg-white shadow-md transition-all ${
                    isActive
                      ? 'border-blue-500 ring-2 ring-blue-200'
                      : isFilled
                        ? compatibility && compatibility < 0.6
                          ? 'border-red-400'
                          : 'border-green-400'
                        : 'border-gray-200'
                  }`}
                >
                  <div className="p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <div
                        className={`rounded-lg border-2 p-2 ${colorClasses[config.color]}`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">
                          {config.label}
                        </h3>
                        <p className="text-xs text-gray-500">{config.description}</p>
                      </div>
                      {isFilled && (
                        <>
                          {compatibility && compatibility >= 0.8 && (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          )}
                          {compatibility && compatibility < 0.6 && (
                            <AlertCircle className="h-5 w-5 text-red-600" />
                          )}
                        </>
                      )}
                    </div>

                    {/* Compatibility Score Bar */}
                    {isFilled && compatibility !== undefined && (
                      <div className="mb-2">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-600">Compatibility</span>
                          <span className={`font-medium ${
                            compatibility >= 0.8 ? 'text-green-600' :
                            compatibility >= 0.6 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {Math.round(compatibility * 100)}%
                          </span>
                        </div>
                        <div className="h-1 bg-gray-200 rounded-full">
                          <div
                            className={`h-1 rounded-full ${
                              compatibility >= 0.8 ? 'bg-green-500' :
                              compatibility >= 0.6 ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${compatibility * 100}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="relative">
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
                        className="w-full rounded-lg border-2 border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-100"
                      />
                    </div>

                    {/* Refinement Suggestions */}
                    {hasRefinements && (
                      <div className="mt-2 p-2 bg-blue-50 rounded-lg">
                        <div className="text-xs text-blue-700 mb-1">Consider refining:</div>
                        <div className="flex flex-wrap gap-1">
                          {refinementSuggestions[key].slice(0, 2).map((ref, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleElementChange(key, ref)}
                              className="px-2 py-1 text-xs bg-white rounded border border-blue-200 hover:bg-blue-100"
                            >
                              {ref}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-2 flex flex-wrap gap-1">
                      {config.examples.slice(0, 3).map((example, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleElementChange(key, example)}
                          className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600 transition-colors hover:bg-gray-200"
                        >
                          {example}
                        </button>
                      ))}
                      <button
                        onClick={() => fetchSuggestionsForElement(key)}
                        className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-200"
                      >
                        <Sparkles className="mr-1 inline h-3 w-3" />
                        AI Suggest
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Suggestions Panel */}
      {activeElement && (
        <div className="mb-8 rounded-xl border-2 border-blue-300 bg-white p-6 shadow-lg">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">
              <Sparkles className="mr-2 inline h-5 w-5 text-blue-600" />
              AI Suggestions for {elementConfig[activeElement].label}
            </h3>
            <div className="flex items-center gap-2">
              {needsRefresh && !isLoadingSuggestions && (
                <button
                  onClick={() => fetchSuggestionsForElement(activeElement)}
                  className="flex items-center gap-1 rounded-lg bg-blue-100 px-3 py-1.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-200"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </button>
              )}
              <button
                onClick={() => {
                  setActiveElement(null);
                  setSuggestions([]);
                  setNeedsRefresh(false);
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {isLoadingSuggestions ? (
            <div className="py-8 text-center">
              <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-blue-600" />
              <p className="text-sm text-gray-600">
                Finding context-aware options...
              </p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {suggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="rounded-lg border-2 border-gray-200 p-4 text-left transition-all hover:border-blue-400 hover:shadow-md"
                >
                  <div className="mb-1 flex items-start justify-between">
                    <div className="font-semibold text-gray-900">
                      {suggestion.text}
                    </div>
                    {suggestion.compatibility && (
                      <span className={`text-xs px-2 py-1 rounded ${
                        suggestion.compatibility >= 0.8 ? 'bg-green-100 text-green-700' :
                        suggestion.compatibility >= 0.6 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {Math.round(suggestion.compatibility * 100)}% fit
                      </span>
                    )}
                  </div>
                  {suggestion.explanation && (
                    <div className="text-xs text-gray-600">
                      {suggestion.explanation}
                    </div>
                  )}
                  {suggestion.technicalNote && (
                    <div className="mt-2 text-xs text-blue-600">
                      💡 {suggestion.technicalNote}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Generate Button - Bottom Right */}
      <div className="flex justify-end mt-8">
        <button
          onClick={() => handleGenerateTemplate('detailed')}
          disabled={!isReadyToGenerate}
          className="flex items-center justify-center gap-2 rounded-full bg-primary-700 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:bg-primary-800 hover:shadow-xl disabled:cursor-not-allowed disabled:bg-neutral-400 disabled:opacity-60 hover-scale"
          title={isReadyToGenerate ? 'Generate optimized prompt' : 'Fill at least 3 elements to continue'}
        >
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}