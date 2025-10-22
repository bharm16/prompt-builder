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
  AlertCircle,
  CheckCircle,
  Info,
  Wand2,
  Brain,
  BookOpen,
  Tag,
} from 'lucide-react';
import SuggestionsPanel from './SuggestionsPanel';

const SUBJECT_DESCRIPTOR_KEYS = ['subjectDescriptor1', 'subjectDescriptor2', 'subjectDescriptor3'];
const PRIMARY_ELEMENT_KEYS = ['subject', 'action', 'location', 'time', 'mood', 'style', 'event'];
const ELEMENT_CARD_ORDER = PRIMARY_ELEMENT_KEYS;
const isSubjectDescriptorKey = (key) => SUBJECT_DESCRIPTOR_KEYS.includes(key);
const SUBJECT_CONNECTOR_WORDS = [
  'with',
  'holding',
  'carrying',
  'wearing',
  'using',
  'playing',
  'strumming',
  'standing',
  'sitting',
  'leaning',
  'bathed',
  'surrounded',
  'and',
  'gazing',
  'watching',
  'dancing',
  'singing',
  'running',
  'walking',
  'cradling',
  'clutching',
  'embracing',
  'guarding',
  'lit',
  'framed',
  'draped',
  'illuminated',
  'tuning',
  'polishing',
  'shining'
];

const splitDescriptorSegments = (text) => {
  if (!text) return [];

  const words = text.trim().split(/\s+/);
  const segments = [];
  let current = '';

  words.forEach((word) => {
    const lower = word.toLowerCase();
    if (SUBJECT_CONNECTOR_WORDS.includes(lower)) {
      if (current.trim()) {
        segments.push(current.trim());
      }
      current = word;
    } else if (current) {
      current = `${current} ${word}`;
    } else {
      current = word;
    }
  });

  if (current.trim()) {
    segments.push(current.trim());
  }

  return segments;
};

// Element dependency hierarchy
const ELEMENT_HIERARCHY = {
  subject: { priority: 1, dependencies: [] },
  subjectDescriptor1: { priority: 1.1, dependencies: ['subject'] },
  subjectDescriptor2: { priority: 1.2, dependencies: ['subject'] },
  subjectDescriptor3: { priority: 1.3, dependencies: ['subject'] },
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
  subjectDescriptors: SUBJECT_DESCRIPTOR_KEYS,
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

const TECHNICAL_SECTION_ORDER = ['camera', 'lighting', 'color', 'format', 'audio', 'postProduction'];

export default function VideoConceptBuilder({
  onConceptComplete,
  initialConcept = '',
}) {
  // Core state
  const [mode, setMode] = useState('element');
  const [concept, setConcept] = useState(initialConcept);
  const [elements, setElements] = useState({
    subject: '',
    subjectDescriptor1: '',
    subjectDescriptor2: '',
    subjectDescriptor3: '',
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
  const [compatibilityScores, setCompatibilityScores] = useState({});
  const [conflicts, setConflicts] = useState([]);
  const [isLoadingConflicts, setIsLoadingConflicts] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [validationScore, setValidationScore] = useState(null);
  const [elementHistory, setElementHistory] = useState([]);
  const [refinements, setRefinements] = useState({});
  const [isLoadingRefinements, setIsLoadingRefinements] = useState(false);
  const [technicalParams, setTechnicalParams] = useState(null);
  const [isLoadingTechnicalParams, setIsLoadingTechnicalParams] = useState(false);
  const [showGuidance, setShowGuidance] = useState(false);

  const normalizeDescriptor = useCallback((value) => value?.replace(/^[,;:\-\s]+/, '').trim() || '', []);

  const composeSubjectValue = useCallback((subjectValue, descriptorValues) => {
    const base = subjectValue?.trim() || '';
    const cleanedDescriptors = descriptorValues
      .map(normalizeDescriptor)
      .filter(Boolean);

    if (!base && cleanedDescriptors.length === 0) {
      return '';
    }

    if (!base) {
      return cleanedDescriptors.join(', ');
    }

    let result = base;
    cleanedDescriptors.forEach((descriptor, index) => {
      if (!descriptor) return;
      const firstWord = descriptor.split(/\s+/)[0]?.toLowerCase() || '';
      const shouldAttachWithSpace =
        index === 0 && SUBJECT_CONNECTOR_WORDS.includes(firstWord);
      result = shouldAttachWithSpace ? `${result} ${descriptor}` : `${result}, ${descriptor}`;
    });

    return result;
  }, [normalizeDescriptor]);

  const decomposeSubjectValue = useCallback((subjectValue) => {
    if (!subjectValue) {
      return {
        subject: '',
        descriptors: ['', '', ''],
      };
    }

    let working = subjectValue.trim();
    const descriptors = [];

    const connectorRegex = new RegExp(`\\b(${SUBJECT_CONNECTOR_WORDS.join('|')})\\b`, 'i');
    const commaParts = working.split(',').map((part) => part.trim()).filter(Boolean);

    if (commaParts.length > 1) {
      working = commaParts[0];
      descriptors.push(...commaParts.slice(1));
    }

    const connectorMatch = connectorRegex.exec(working);
    if (connectorMatch) {
      const connectorIndex = connectorMatch.index;
      const remainder = working.slice(connectorIndex).trim();
      if (remainder) {
        descriptors.unshift(remainder);
      }
      working = working.slice(0, connectorIndex).trim();
    }

    const descriptorCandidates = descriptors.flatMap((descriptor) => {
      const segments = splitDescriptorSegments(descriptor);
      return segments.length > 0 ? segments : [descriptor];
    });

    const uniqueDescriptors = [];
    descriptorCandidates.forEach((descriptor) => {
      const normalized = normalizeDescriptor(descriptor);
      if (normalized && !uniqueDescriptors.includes(normalized)) {
        uniqueDescriptors.push(normalized);
      }
    });

    while (uniqueDescriptors.length < SUBJECT_DESCRIPTOR_KEYS.length) {
      uniqueDescriptors.push('');
    }

    return {
      subject: working,
      descriptors: uniqueDescriptors.slice(0, SUBJECT_DESCRIPTOR_KEYS.length),
    };
  }, [normalizeDescriptor]);

  const buildComposedElements = useCallback((sourceElements) => {
    const descriptorValues = SUBJECT_DESCRIPTOR_KEYS.map((key) => sourceElements[key] || '');
    const subjectWithDescriptors = composeSubjectValue(sourceElements.subject, descriptorValues);

    return {
      ...sourceElements,
      subject: subjectWithDescriptors,
      subjectDescriptors: descriptorValues
        .map(normalizeDescriptor)
        .filter(Boolean),
    };
  }, [composeSubjectValue, normalizeDescriptor]);

  const applyElements = useCallback((incomingElements) => {
    if (!incomingElements) return;

    setElements((prev) => {
      const merged = { ...prev, ...incomingElements };
      if (incomingElements.subject !== undefined) {
        const { subject, descriptors } = decomposeSubjectValue(incomingElements.subject);
        merged.subject = subject;
        SUBJECT_DESCRIPTOR_KEYS.forEach((key, idx) => {
          merged[key] = descriptors[idx] || '';
        });
      }
      if (Array.isArray(incomingElements.subjectDescriptors)) {
        SUBJECT_DESCRIPTOR_KEYS.forEach((key, idx) => {
          merged[key] =
            normalizeDescriptor(incomingElements.subjectDescriptors[idx]) || merged[key] || '';
        });
      }
      SUBJECT_DESCRIPTOR_KEYS.forEach((key) => {
        if (incomingElements[key] === undefined && merged[key] === undefined) {
          merged[key] = '';
        } else if (incomingElements[key] !== undefined) {
          merged[key] = normalizeDescriptor(incomingElements[key]);
        }
      });
      return merged;
    });
  }, [decomposeSubjectValue, normalizeDescriptor]);

  const activeElementRef = useRef(null);
  const suggestionsForRef = useRef(null);
  const conflictRequestRef = useRef(0);
  const refinementRequestRef = useRef(0);
  const technicalParamsRequestRef = useRef(0);

  const elementConfig = {
    subject: {
      icon: User,
      label: 'Subject',
      placeholder: 'Who/what with 2-3 visual details (e.g., "elderly historian with trembling hands")',
      color: 'slate',
      examples: ['elderly street musician with weathered hands', 'matte black DJI drone with amber LEDs', 'bengal cat with spotted coat'],
      group: 'core',
      optional: false,
    },
    subjectDescriptor1: {
      icon: Tag,
      label: 'Descriptor 1',
      placeholder: 'Optional visual detail (e.g., "with weathered hands")',
      color: 'slate',
      examples: ['with weathered hands', 'wearing a sun-faded suit', 'holding a silver harmonica'],
      group: 'subjectDescriptors',
      optional: true,
    },
    subjectDescriptor2: {
      icon: Tag,
      label: 'Descriptor 2',
      placeholder: 'Optional second detail (e.g., "strumming a guitar")',
      color: 'slate',
      examples: ['strumming a worn guitar', 'bathed in warm window light', 'surrounded by curious onlookers'],
      group: 'subjectDescriptors',
      optional: true,
    },
    subjectDescriptor3: {
      icon: Tag,
      label: 'Descriptor 3',
      placeholder: 'Optional third detail (e.g., "strings vibrating with each note")',
      color: 'slate',
      examples: ['strings vibrating with each note', 'eyes closed in concentration', 'rain collecting on the brim of his hat'],
      group: 'subjectDescriptors',
      optional: true,
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
      const updatedElements = buildComposedElements({
        ...elements,
        [elementType]: value,
      });

      const response = await fetch('/api/video/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'dev-key-12345'
        },
        body: JSON.stringify({
          elementType,
          value,
          elements: updatedElements,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data?.compatibility?.score || 0.5;
      }
    } catch (error) {
      console.error('Error checking compatibility:', error);
    }
    return 0.5;
  }, [buildComposedElements, elements]);

  // Debounce timers for compatibility checks per element
  const compatibilityTimersRef = useRef({});

  // Detect conflicts between elements
  const detectConflicts = useCallback(async (currentElements) => {
    const enrichedElements = buildComposedElements(currentElements);
    const filledCount = PRIMARY_ELEMENT_KEYS.filter((key) => enrichedElements[key]).length;

    if (filledCount < 2) {
      setConflicts([]);
      setIsLoadingConflicts(false);
      return;
    }

    const requestId = Date.now();
    conflictRequestRef.current = requestId;
    setIsLoadingConflicts(true);

    try {
      const response = await fetch('/api/video/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'dev-key-12345'
        },
        body: JSON.stringify({ elements: enrichedElements }),
      });

      if (!response.ok) {
        throw new Error('Failed to detect conflicts');
      }

      const data = await response.json();

      if (conflictRequestRef.current === requestId) {
        setConflicts(data.conflicts || []);
      }
    } catch (error) {
      console.error('Error detecting conflicts:', error);
      if (conflictRequestRef.current === requestId) {
        setConflicts([]);
      }
    } finally {
      if (conflictRequestRef.current === requestId) {
        setIsLoadingConflicts(false);
      }
    }
  }, [buildComposedElements]);

  // Progressive refinement suggestions
  const fetchRefinementSuggestions = useCallback(async (currentElements) => {
    const composedElements = buildComposedElements(currentElements);
    const filledCount = PRIMARY_ELEMENT_KEYS.filter((key) => composedElements[key]).length;

    if (filledCount < 2) {
      setRefinements({});
      setIsLoadingRefinements(false);
      return;
    }

    const requestId = Date.now();
    refinementRequestRef.current = requestId;
    setIsLoadingRefinements(true);

    try {
      const response = await fetch('/api/video/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'dev-key-12345'
        },
        body: JSON.stringify({ existingElements: composedElements }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch refinements');
      }

      const data = await response.json();

      if (refinementRequestRef.current === requestId) {
        setRefinements(data.smartDefaults?.refinements || data.refinements || {});
      }
    } catch (error) {
      console.error('Error fetching refinement suggestions:', error);
      if (refinementRequestRef.current === requestId) {
        setRefinements({});
      }
    } finally {
      if (refinementRequestRef.current === requestId) {
        setIsLoadingRefinements(false);
      }
    }
  }, [buildComposedElements]);

  const requestTechnicalParams = useCallback(async (currentElements) => {
    const composedElements = buildComposedElements(currentElements);
    const filledCount = PRIMARY_ELEMENT_KEYS.filter((key) => composedElements[key]).length;

    if (filledCount < 3) {
      setTechnicalParams(null);
      setIsLoadingTechnicalParams(false);
      return null;
    }

    const requestId = Date.now();
    technicalParamsRequestRef.current = requestId;
    setIsLoadingTechnicalParams(true);

    try {
      const response = await fetch('/api/video/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'dev-key-12345'
        },
        body: JSON.stringify({
          existingElements: composedElements,
          smartDefaultsFor: 'technical',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate technical parameters');
      }

      const data = await response.json();
      const params =
        data.smartDefaults?.technical ||
        data.smartDefaults ||
        data.technicalParams ||
        {};

      if (technicalParamsRequestRef.current === requestId) {
        setTechnicalParams(params);
      }

      return params;
    } catch (error) {
      console.error('Error generating technical parameters:', error);
      if (technicalParamsRequestRef.current === requestId) {
        setTechnicalParams({});
      }
      return {};
    } finally {
      if (technicalParamsRequestRef.current === requestId) {
        setIsLoadingTechnicalParams(false);
      }
    }
  }, [buildComposedElements]);

  // Validate prompt completeness and quality
  const validatePrompt = useCallback(() => {
    let score = 0;
    let feedback = [];

    const composed = buildComposedElements(elements);
    const filledCount = PRIMARY_ELEMENT_KEYS.filter((key) => composed[key]).length;
    score += (filledCount / PRIMARY_ELEMENT_KEYS.length) * 30;

    if (conflicts.length === 0) {
      score += 20;
    } else {
      feedback.push('Resolve conflicts for better coherence');
    }

    const specificityScore = PRIMARY_ELEMENT_KEYS.filter(
      (key) => composed[key] && composed[key].length > 10
    ).length;
    score += (specificityScore / PRIMARY_ELEMENT_KEYS.length) * 20;

    if (filledByGroup.core === 3) {
      score += 20;
    } else {
      feedback.push(`Fill ${3 - filledByGroup.core} more core elements`);
    }

    if (composed.style && composed.mood) {
      score += 10;
      feedback.push('Good visual definition!');
    }

    setValidationScore({ score: Math.min(100, Math.round(score)), feedback });
  }, [buildComposedElements, elements, conflicts, filledByGroup]);

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
  const isFetchingSuggestionsRef = useRef(false);

  // Fetch suggestions with context awareness (cooldown + cancel in-flight)
  const fetchSuggestionsForElement = async (elementType) => {
    const composed = buildComposedElements(elements);
    const contextObject = {
      ...composed,
      conflicts: (conflicts || []).map(conflict => ({
        message: conflict.message,
        resolution: conflict.resolution || conflict.suggestion || null,
        severity: conflict.severity || null,
      })),
    };
    const contextSummary = Object.entries(contextObject)
      .filter(([key, value]) => {
        if (!value || key === elementType || key === 'subjectDescriptors') return false;
        if (key === 'conflicts') return value.length > 0;
        return true;
      })
      .map(([key, value]) => {
        if (key === 'conflicts') {
          return `${value.length} conflict${value.length === 1 ? '' : 's'} present`;
        }
        const displayValue = Array.isArray(value) ? value.join('; ') : value;
        return `${formatLabel(key)}: ${displayValue}`;
      })
      .join(', ');
    const dedupeKey = `${elementType}|${composed[elementType] || ''}|${contextSummary}|${concept || ''}`;
    const now = Date.now();
    if (lastSuggestionRef.current.key === dedupeKey && now - lastSuggestionRef.current.ts < 800) {
      return;
    }

    if (isFetchingSuggestionsRef.current && activeElementRef.current === elementType) {
      return;
    }

    lastSuggestionRef.current = { key: dedupeKey, ts: now };

    if (suggestionAbortRef.current) {
      suggestionAbortRef.current.abort();
    }
    suggestionAbortRef.current = new AbortController();

    isFetchingSuggestionsRef.current = true;
    setIsLoadingSuggestions(true);
    setActiveElement(elementType);
    activeElementRef.current = elementType;
    try {
      const response = await fetch(
        '/api/video/suggestions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': 'dev-key-12345'
          },
          body: JSON.stringify({
            elementType,
            currentValue: composed[elementType],
            context: contextObject,
            concept,
          }),
          signal: suggestionAbortRef.current.signal,
        }
      );

      if (!response.ok) throw new Error('Failed to fetch suggestions');

      const data = await response.json();
      setSuggestions(data.suggestions || []);
      suggestionsForRef.current = elementType;
    } catch (error) {
      if (error?.name === 'AbortError') {
        return;
      }
      console.error('Error fetching suggestions:', error);
      setSuggestions([]);
      suggestionsForRef.current = null;
    } finally {
      setIsLoadingSuggestions(false);
      isFetchingSuggestionsRef.current = false;
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
    const composedElements = buildComposedElements(elements);
    const emptyElements = ELEMENT_CARD_ORDER.filter((key) => !composedElements[key]);

    if (emptyElements.length === 0) return;

    setIsLoadingSuggestions(true);

    try {
      const response = await fetch(
        '/api/video/complete',
        {
          method: 'POST',
          headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'dev-key-12345'
        },
        body: JSON.stringify({
          existingElements: composedElements,
          concept,
        }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      applyElements(data.suggestions);
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
        '/api/video/parse',
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
        applyElements(data.elements);
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
      applyElements(template.elements);
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

  const activeElementConfig = activeElement ? elementConfig[activeElement] : null;

  const suggestionsPanelData = useMemo(() => {
    const baseData = {
      suggestions,
      isLoading: isLoadingSuggestions,
      enableCustomRequest: false,
      panelClassName:
        'w-80 bg-white border-l border-neutral-200 flex flex-col h-screen sticky top-0 shadow-sm',
      inactiveState: {
        icon: Sparkles,
        title: 'Ready to inspire',
        description:
          'Click any element card to get AI-powered suggestions tailored to your concept',
        tips: [
          { icon: Info, text: 'Suggestions adapt based on your filled elements' },
          { icon: Zap, text: 'Use keyboard shortcuts for faster workflow' },
        ],
      },
      emptyState: {
        icon: Sparkles,
        title: 'No suggestions available',
        description: 'Try refreshing suggestions or adjust your element details.',
      },
      showCopyAction: true,
    };

    if (!activeElement) {
      return {
        ...baseData,
        show: false,
        onSuggestionClick: handleSuggestionClick,
      };
    }

    const footerContent = suggestions.length > 0 ? (
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
    ) : null;

    return {
      ...baseData,
      show: true,
      onSuggestionClick: handleSuggestionClick,
      onClose: () => setActiveElement(null),
      onRefresh: () => fetchSuggestionsForElement(activeElement),
      selectedText: elements[activeElement] || '',
      contextLabel: 'Element',
      contextValue: activeElementConfig?.label || '',
      contextSecondaryValue: elements[activeElement] || '',
      contextIcon: activeElementConfig?.icon || null,
      showContextBadge: true,
      contextBadgeText: 'Context-aware',
      keyboardHint:
        suggestions.length > 0
          ? `Use number keys 1-${Math.min(suggestions.length, 8)} for quick selection`
          : null,
      footer: footerContent,
    };
  }, [
    activeElement,
    activeElementConfig,
    elements,
    fetchSuggestionsForElement,
    handleSuggestionClick,
    isLoadingSuggestions,
    setActiveElement,
    suggestions,
  ]);

  // Generate final template
  const handleGenerateTemplate = async (exportFormat = 'detailed') => {
    const composedElements = buildComposedElements(elements);
    const filledElements = Object.entries(composedElements)
      .filter(
        ([key, value]) =>
          value &&
          key !== 'subjectDescriptors' &&
          !isSubjectDescriptorKey(key)
      )
      .map(([key, value]) => `${formatLabel(key)}: ${value}`)
      .join(', ');

    const finalConcept = concept || filledElements;
    let params = technicalParams;

    if (!params || Object.keys(params).length === 0) {
      const latest = await requestTechnicalParams(elements);
      if (latest && Object.keys(latest).length > 0) {
        params = latest;
      } else {
        params = {};
      }
    }

    onConceptComplete(finalConcept, composedElements, {
      format: exportFormat,
      technicalParams: params || {},
      validationScore: validationScore,
      history: elementHistory,
      subjectDescriptors: composedElements.subjectDescriptors || [],
    });
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
    detectConflicts(elements);
  }, [elements, detectConflicts]);

  useEffect(() => {
    validatePrompt();
  }, [elements, validatePrompt]);

  useEffect(() => {
    fetchRefinementSuggestions(elements);
  }, [elements, fetchRefinementSuggestions]);

  useEffect(() => {
    requestTechnicalParams(elements);
  }, [elements, requestTechnicalParams]);

  const formatLabel = useCallback((key) =>
    key
      .replace(/([A-Z])/g, ' $1')
      .replace(/[_-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^./, (str) => str.toUpperCase()),
  []);

  const hasRefinements = useMemo(
    () =>
      Object.entries(refinements || {}).some(
        ([, list]) => Array.isArray(list) && list.length > 0
      ),
    [refinements]
  );

  const hasTechnicalParams = useMemo(
    () => technicalParams && Object.keys(technicalParams).length > 0,
    [technicalParams]
  );

  const describeNestedValue = useCallback((value) => {
    if (Array.isArray(value)) {
      return value.join(', ');
    }

    if (value && typeof value === 'object') {
      return Object.entries(value)
        .map(([nestedKey, nestedValue]) => {
          if (Array.isArray(nestedValue)) {
            return `${formatLabel(nestedKey)}: ${nestedValue.join(', ')}`;
          }
          if (nestedValue && typeof nestedValue === 'object') {
            return `${formatLabel(nestedKey)}: ${describeNestedValue(nestedValue)}`;
          }
          return `${formatLabel(nestedKey)}: ${nestedValue}`;
        })
        .join('; ');
    }

    return value || '';
  }, [formatLabel]);

  const renderTechnicalValue = useCallback((value) => {
    if (Array.isArray(value)) {
      return (
        <ul className="mt-2 space-y-1 text-xs text-neutral-600 leading-relaxed list-disc list-inside">
          {value.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      );
    }

    if (value && typeof value === 'object') {
      return (
        <ul className="mt-2 space-y-1 text-xs text-neutral-600 leading-relaxed">
          {Object.entries(value).map(([subKey, subValue]) => (
            <li key={subKey}>
              <span className="font-semibold text-neutral-700">{formatLabel(subKey)}:</span>{' '}
              {describeNestedValue(subValue)}
            </li>
          ))}
        </ul>
      );
    }

    if (!value) {
      return (
        <p className="mt-2 text-xs text-neutral-500">No recommendation provided.</p>
      );
    }

    return (
      <p className="mt-2 text-xs text-neutral-600 leading-relaxed">{value}</p>
    );
  }, [describeNestedValue, formatLabel]);

  const technicalSections = useMemo(() => {
    if (!technicalParams || typeof technicalParams !== 'object') {
      return [];
    }

    const keys = Object.keys(technicalParams);
    const ordered = TECHNICAL_SECTION_ORDER.filter((key) => keys.includes(key));
    const additional = keys.filter((key) => !TECHNICAL_SECTION_ORDER.includes(key));
    const combined = [...ordered, ...additional];

    return combined.filter((key) => {
      const value = technicalParams[key];
      if (!value) return false;
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'object') {
        return Object.values(value).some((nested) => {
          if (Array.isArray(nested)) return nested.length > 0;
          if (nested && typeof nested === 'object') {
            return Object.values(nested).some(Boolean);
          }
          return Boolean(nested);
        });
      }
      return Boolean(value);
    });
  }, [technicalParams]);

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
        {(isLoadingConflicts || conflicts.length > 0) && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-amber-900">
                    Potential Conflicts Detected
                  </h3>
                  {isLoadingConflicts && (
                    <Loader2 className="h-4 w-4 text-amber-600 animate-spin" />
                  )}
                </div>
                {isLoadingConflicts ? (
                  <p className="text-sm text-amber-800">Analyzing element harmony...</p>
                ) : (
                  conflicts.map((conflict, idx) => {
                    const resolution = conflict.resolution || conflict.suggestion;
                    return (
                      <div key={idx} className="text-sm text-amber-800 mt-2">
                        <div>{conflict.message}</div>
                        {resolution && (
                          <div className="mt-1 text-xs text-amber-700">{resolution}</div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* Refinement Suggestions */}
        {(isLoadingRefinements || hasRefinements) && (
          <div className="mb-6 p-5 bg-white border border-neutral-200 rounded-xl shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-semibold text-neutral-900">
                  AI Refinement Suggestions
                </h3>
              </div>
              {isLoadingRefinements && (
                <Loader2 className="h-4 w-4 text-neutral-400 animate-spin" />
              )}
            </div>

            {hasRefinements ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {Object.entries(refinements)
                  .filter(([, options]) => Array.isArray(options) && options.length > 0)
                  .map(([key, options]) => (
                    <div
                      key={key}
                      className="p-4 rounded-lg border border-neutral-200 bg-neutral-50"
                    >
                      <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                        {elementConfig[key]?.label || formatLabel(key)}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {options.map((option, idx) => (
                          <button
                            key={`${key}-${idx}`}
                            onClick={() => handleElementChange(key, option)}
                            className="px-2.5 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:border-neutral-300 hover:bg-neutral-100 transition-all duration-150"
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              !isLoadingRefinements && (
                <p className="mt-3 text-sm text-neutral-600">
                  Add more detail to unlock tailored refinements.
                </p>
              )
            )}
          </div>
        )}

        {/* Technical Blueprint */}
        {(isLoadingTechnicalParams || hasTechnicalParams) && (
          <div className="mb-6 p-5 bg-white border border-neutral-200 rounded-xl shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-indigo-600" />
                <h3 className="text-sm font-semibold text-neutral-900">
                  Technical Blueprint
                </h3>
              </div>
              {isLoadingTechnicalParams && (
                <Loader2 className="h-4 w-4 text-neutral-400 animate-spin" />
              )}
            </div>

            {hasTechnicalParams && technicalSections.length > 0 ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {technicalSections.map((sectionKey) => (
                  <div
                    key={sectionKey}
                    className="p-4 rounded-lg border border-neutral-200 bg-neutral-50"
                  >
                    <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                      {formatLabel(sectionKey)}
                    </div>
                    {renderTechnicalValue(technicalParams[sectionKey])}
                  </div>
                ))}
              </div>
            ) : (
              !isLoadingTechnicalParams && (
                <p className="mt-3 text-sm text-neutral-600">
                  Add at least three detailed elements to unlock technical recommendations.
                </p>
              )
            )}
          </div>
        )}

        {/* Bento Grid - Element Cards */}
        {mode === 'element' && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {ELEMENT_CARD_ORDER.map((key) => {
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
                      if (
                        (!isFetchingSuggestionsRef.current && suggestionsForRef.current !== key) ||
                        (!isFetchingSuggestionsRef.current &&
                          suggestionsForRef.current === key &&
                          suggestions.length === 0)
                      ) {
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

                  {key === 'subject' && (
                    <div className="mt-5 space-y-3 rounded-lg bg-neutral-50 border border-dashed border-neutral-200 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-neutral-800 uppercase tracking-wide">
                            Optional Subject Descriptors
                          </span>
                          <span className="text-[11px] text-neutral-500">
                            Add up to three visual anchors to keep AI suggestions precise.
                          </span>
                        </div>
                        <div className="hidden sm:flex items-center gap-1 text-[11px] text-neutral-500">
                          <Sparkles className="h-3 w-3" />
                          <span>Use AI to fill any slot</span>
                        </div>
                      </div>

                      {SUBJECT_DESCRIPTOR_KEYS.map((descriptorKey, idx) => {
                        const descriptorConfig = elementConfig[descriptorKey];
                        const descriptorValue = elements[descriptorKey] || '';
                        const descriptorFilled = Boolean(descriptorValue);
                        const descriptorCompatibility = compatibilityScores[descriptorKey];

                        return (
                          <div
                            key={descriptorKey}
                            className="rounded-lg border border-neutral-200 bg-white/80 p-3"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <Tag className="h-3.5 w-3.5 text-neutral-500" />
                              <span className="text-xs font-semibold text-neutral-700">
                                Descriptor {idx + 1}
                              </span>
                              <span className="text-[10px] text-neutral-400">Optional</span>
                              {descriptorFilled && descriptorCompatibility !== undefined && (
                                <span className="ml-auto flex items-center gap-1 text-[10px] text-neutral-500">
                                  {descriptorCompatibility >= 0.8 ? (
                                    <>
                                      <CheckCircle className="h-3 w-3 text-emerald-500" />
                                      <span>Strong</span>
                                    </>
                                  ) : descriptorCompatibility < 0.6 ? (
                                    <>
                                      <AlertCircle className="h-3 w-3 text-amber-500" />
                                      <span>Rework</span>
                                    </>
                                  ) : null}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={descriptorValue}
                                onChange={(e) => handleElementChange(descriptorKey, e.target.value)}
                                onFocus={() => {
                                  if (
                                    (!isFetchingSuggestionsRef.current &&
                                      suggestionsForRef.current !== descriptorKey) ||
                                    (!isFetchingSuggestionsRef.current &&
                                      suggestionsForRef.current === descriptorKey &&
                                      suggestions.length === 0)
                                  ) {
                                    fetchSuggestionsForElement(descriptorKey);
                                  }
                                }}
                                placeholder={descriptorConfig.placeholder}
                                className="flex-1 px-3 py-2 text-sm text-neutral-900 bg-neutral-50 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                              />
                              <button
                                onClick={() => fetchSuggestionsForElement(descriptorKey)}
                                className="group relative overflow-hidden px-2 py-1.5 text-[11px] font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 active:scale-95"
                                title="Get AI descriptor ideas"
                              >
                                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                                <div className="relative flex items-center gap-1">
                                  <Sparkles className="h-3 w-3" />
                                  <span>AI Fill</span>
                                </div>
                              </button>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {descriptorConfig.examples.map((example, exampleIdx) => (
                                <button
                                  key={`${descriptorKey}-example-${exampleIdx}`}
                                  onClick={() => handleElementChange(descriptorKey, example)}
                                  className="px-2.5 py-1.5 text-[11px] font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:border-neutral-300 hover:bg-neutral-50 transition-all duration-150 active:scale-95"
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
              );
            })}
          </div>
        )}

        </div>
      </div>

      <SuggestionsPanel suggestionsData={suggestionsPanelData} />

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
