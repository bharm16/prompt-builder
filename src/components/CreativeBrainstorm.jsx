import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';

export default function CreativeBrainstorm({
  onConceptComplete,
  initialConcept = '',
}) {
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
  const [activeElement, setActiveElement] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const previousElementsRef = useRef(elements);

  const elementConfig = {
    subject: {
      icon: User,
      label: 'Subject/Character',
      placeholder: 'Who or what is the main focus?',
      color: 'blue',
      examples: ['person', 'product', 'animal', 'vehicle', 'object'],
    },
    action: {
      icon: Zap,
      label: 'Action/Activity',
      placeholder: 'What is happening?',
      color: 'purple',
      examples: ['walking', 'floating', 'exploding', 'transforming', 'dancing'],
    },
    location: {
      icon: MapPin,
      label: 'Location/Setting',
      placeholder: 'Where does this take place?',
      color: 'green',
      examples: [
        'urban street',
        'mountain peak',
        'underwater',
        'space',
        'studio',
      ],
    },
    time: {
      icon: Calendar,
      label: 'Time/Period',
      placeholder: 'When does this happen?',
      color: 'orange',
      examples: ['golden hour', 'midnight', 'future', 'past', 'present'],
    },
    mood: {
      icon: Palette,
      label: 'Mood/Atmosphere',
      placeholder: 'What feeling should it evoke?',
      color: 'pink',
      examples: ['dramatic', 'peaceful', 'energetic', 'mysterious', 'romantic'],
    },
    style: {
      icon: Sparkles,
      label: 'Visual Style',
      placeholder: 'What artistic style?',
      color: 'indigo',
      examples: ['cinematic', 'documentary', 'anime', 'abstract', 'vintage'],
    },
    event: {
      icon: Lightbulb,
      label: 'Event/Context',
      placeholder: "What's the occasion or context?",
      color: 'yellow',
      examples: [
        'product launch',
        'celebration',
        'demonstration',
        'transformation',
        'reveal',
      ],
    },
  };

  const colorClasses = {
    blue: 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100',
    purple:
      'bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100',
    green: 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100',
    orange:
      'bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100',
    pink: 'bg-pink-50 border-pink-300 text-pink-700 hover:bg-pink-100',
    indigo:
      'bg-indigo-50 border-indigo-300 text-indigo-700 hover:bg-indigo-100',
    yellow:
      'bg-yellow-50 border-yellow-300 text-yellow-700 hover:bg-yellow-100',
  };

  // Watch for changes in other elements when suggestions panel is open
  useEffect(() => {
    if (!activeElement) {
      previousElementsRef.current = elements;
      return;
    }

    // Check if any OTHER element changed (not the active one)
    const previousElements = previousElementsRef.current;
    const hasOtherElementChanged = Object.keys(elements).some((key) => {
      if (key === activeElement) return false; // Skip the active element
      return elements[key] !== previousElements[key];
    });

    if (hasOtherElementChanged) {
      console.log('🔄 Context changed, showing refresh button');
      setNeedsRefresh(true);
    }

    previousElementsRef.current = elements;
  }, [elements, activeElement]);

  const fetchSuggestionsForElement = async (elementType) => {
    setIsLoadingSuggestions(true);
    setActiveElement(elementType);
    setNeedsRefresh(false); // Reset refresh indicator

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

  const handleSuggestionClick = (suggestion) => {
    if (activeElement) {
      setElements((prev) => ({
        ...prev,
        [activeElement]: suggestion.text,
      }));
      setActiveElement(null);
      setSuggestions([]);
    }
  };

  const handleGenerateTemplate = () => {
    const filledElements = Object.entries(elements)
      .filter(([_, value]) => value)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');

    const finalConcept = concept || filledElements;
    onConceptComplete(finalConcept, elements);
  };

  const filledCount = Object.values(elements).filter((v) => v).length;
  const isReadyToGenerate = filledCount >= 3;

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
        setNeedsRefresh(false);
      }

      // R to refresh suggestions
      if (e.key === 'r' && activeElement && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        fetchSuggestionsForElement(activeElement);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [activeElement, suggestions]);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-8 text-center">
        <h2 className="mb-2 text-3xl font-bold text-gray-900">
          Build Your Video Concept
        </h2>
        <p className="text-gray-600">
          Define the basic elements first, then we&apos;ll add technical details
        </p>
      </div>

      <div className="mb-8 rounded-xl border-2 border-gray-200 bg-white p-6 shadow-md">
        <label className="mb-2 block text-sm font-semibold text-gray-700">
          Quick Concept (Optional)
        </label>
        <textarea
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
          placeholder="Describe your video idea in a sentence or two... Or use the element builder below"
          className="w-full resize-none rounded-lg border-2 border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none"
          rows={3}
        />
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-2">
        {Object.entries(elementConfig).map(([key, config]) => {
          const Icon = config.icon;
          const isActive = activeElement === key;
          const isFilled = elements[key];

          return (
            <div
              key={key}
              className={`relative rounded-xl border-2 bg-white shadow-md transition-all ${
                isActive
                  ? 'border-blue-500 ring-2 ring-blue-200'
                  : isFilled
                    ? 'border-green-400'
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
                  <h3 className="font-semibold text-gray-900">
                    {config.label}
                  </h3>
                  {isFilled && (
                    <span className="ml-auto text-xs font-medium text-green-600">
                      ✓ Set
                    </span>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={elements[key]}
                    onChange={(e) =>
                      setElements((prev) => ({
                        ...prev,
                        [key]: e.target.value,
                      }))
                    }
                    onFocus={() => {
                      if (suggestions.length === 0 || activeElement !== key) {
                        fetchSuggestionsForElement(key);
                      }
                    }}
                    placeholder={config.placeholder}
                    className="w-full rounded-lg border-2 border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="mt-2 flex flex-wrap gap-1">
                  {config.examples.slice(0, 3).map((example, idx) => (
                    <button
                      key={idx}
                      onClick={() =>
                        setElements((prev) => ({ ...prev, [key]: example }))
                      }
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
                    More
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modern AI Suggestions Panel - 2025 Redesign */}
      {activeElement && (
        <div className="mb-8 rounded-xl border border-neutral-200 bg-white shadow-lg overflow-hidden">
          {/* Modern Panel Header with Glassmorphism */}
          <div className="px-5 py-4 border-b border-neutral-200 bg-gradient-to-b from-neutral-50/50 to-white backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-gradient-to-br from-neutral-100 to-neutral-50 rounded-lg shadow-sm ring-1 ring-neutral-200/50">
                  <Sparkles className="h-4 w-4 text-neutral-700" />
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold text-neutral-900 tracking-tight">
                    AI Suggestions
                  </h3>
                  <p className="text-[12px] text-neutral-600">
                    For: {elementConfig[activeElement].label}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {needsRefresh && !isLoadingSuggestions && (
                  <button
                    onClick={() => fetchSuggestionsForElement(activeElement)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-neutral-900 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-all duration-150 active:scale-95"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Refresh
                  </button>
                )}
                <button
                  onClick={() => {
                    setActiveElement(null);
                    setSuggestions([]);
                    setNeedsRefresh(false);
                  }}
                  className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-all duration-150"
                  title="Close suggestions"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Context Change Alert */}
          {needsRefresh && !isLoadingSuggestions && (
            <div className="mx-5 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-[13px] text-amber-800 leading-relaxed">
                💡 Other elements have changed. Click &quot;Refresh&quot; to get updated suggestions.
              </p>
            </div>
          )}

          {/* Panel Content */}
          <div className="p-5">
            {isLoadingSuggestions ? (
              /* Modern Skeleton Loader with Shimmer Effect */
              <div className="grid gap-3 md:grid-cols-2">
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
                      <div className="h-4 bg-neutral-200/70 rounded-md w-3/4" />
                      <div className="h-3 bg-neutral-200/50 rounded-md w-full" />
                      <div className="h-3 bg-neutral-200/50 rounded-md w-5/6" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Modern Suggestion Cards with Stagger Animation */
              <div className="grid gap-3 md:grid-cols-2">
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
                      className="w-full p-4 text-left bg-white border border-neutral-200 rounded-xl hover:border-neutral-300 hover:shadow-md transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400 active:scale-[0.98]"
                    >
                      {/* Keyboard Shortcut Indicator */}
                      {idx < 8 && (
                        <kbd className="absolute top-3 right-3 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-400 bg-neutral-100 border border-neutral-200 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                          {idx + 1}
                        </kbd>
                      )}

                      <div className="mb-2 pr-6">
                        <div className="text-[14px] font-semibold text-neutral-900 leading-snug">
                          {suggestion.text}
                        </div>
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
              </div>
            )}

            {/* Bottom Helper Text */}
            {!isLoadingSuggestions && suggestions.length > 0 && (
              <div className="mt-4 pt-4 border-t border-neutral-200 text-center">
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  Use number keys 1-{Math.min(suggestions.length, 8)} • Press <kbd className="px-1.5 py-0.5 text-[10px] font-semibold bg-neutral-100 border border-neutral-200 rounded">Esc</kbd> to close • <kbd className="px-1.5 py-0.5 text-[10px] font-semibold bg-neutral-100 border border-neutral-200 rounded">R</kbd> to refresh
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="rounded-xl border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-6 shadow-md">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Concept Progress</h3>
            <p className="text-sm text-gray-600">
              {filledCount} of 7 elements defined
              {!isReadyToGenerate && ' (minimum 3 required)'}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600">
              {Math.round((filledCount / 7) * 100)}%
            </div>
            <div className="text-xs text-gray-600">Complete</div>
          </div>
        </div>

        <div className="mb-4 h-2 w-full rounded-full bg-gray-200">
          <div
            className="h-2 rounded-full bg-blue-600 transition-all duration-300"
            style={{ width: `${(filledCount / 7) * 100}%` }}
          ></div>
        </div>

        <button
          onClick={handleGenerateTemplate}
          disabled={!isReadyToGenerate}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {isReadyToGenerate ? (
            <>
              Generate Detailed Template
              <ArrowRight className="h-5 w-5" />
            </>
          ) : (
            <>Fill at least 3 elements to continue</>
          )}
        </button>
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
