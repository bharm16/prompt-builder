// src/PromptImprovementForm.jsx
import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Plus, Loader2 } from 'lucide-react';

const PromptImprovementForm = ({ onComplete, initialPrompt = '' }) => {
  const [expandedSection, setExpandedSection] = useState(1);
  const [formData, setFormData] = useState({
    specificAspects: '',
    backgroundLevel: '',
    intendedUse: '',
  });
  const [questions, setQuestions] = useState([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [error, setError] = useState(null);

  // Fetch AI-generated context-aware questions
  useEffect(() => {
    const fetchQuestions = async () => {
      setIsLoadingQuestions(true);
      setError(null);

      try {
        

        const response = await fetch(
          '/api/generate-questions',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': 'dev-key-12345',
            },
            body: JSON.stringify({
              prompt: initialPrompt,
            }),
          }
        );

        

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ API Error:', errorText);
          throw new Error(`Failed to generate questions: ${response.status}`);
        }

        const data = await response.json();
        

        if (data.questions && Array.isArray(data.questions)) {
          setQuestions(data.questions);
          
        } else {
          throw new Error('Invalid response format');
        }
      } catch (err) {
        console.error('❌ Error fetching questions:', err);
        
        setError(err.message);
        // Fallback to static questions
        setQuestions(generateFallbackQuestions());
      } finally {
        setIsLoadingQuestions(false);
      }
    };

    if (initialPrompt) {
      fetchQuestions();
    }
  }, [initialPrompt]);

  // Fallback static questions in case API fails
  const generateFallbackQuestions = () => {
    const prompt = initialPrompt.toLowerCase();
    const promptType = detectPromptType(prompt);
    const topic = extractTopic(initialPrompt);

    // Question 1: Context-specific aspects
    const aspectQuestion = {
      id: 1,
      title: generateAspectTitle(promptType),
      description: generateAspectDescription(promptType, topic),
      field: 'specificAspects',
      examples: generateAspectExamples(prompt),
    };

    // Question 2: Audience/background level
    const backgroundQuestion = {
      id: 2,
      title: generateBackgroundTitle(promptType),
      description: generateBackgroundDescription(promptType, topic),
      field: 'backgroundLevel',
      examples: generateBackgroundExamples(prompt, topic),
    };

    // Question 3: Purpose/use case
    const useQuestion = {
      id: 3,
      title: generateUseTitle(promptType),
      description: generateUseDescription(promptType),
      field: 'intendedUse',
      examples: generateUseExamples(prompt),
    };

    return [aspectQuestion, backgroundQuestion, useQuestion];
  };

  const detectPromptType = (prompt) => {
    if (prompt.includes('compar')) return 'compare';
    if (
      prompt.includes('explain') ||
      prompt.includes('how does') ||
      prompt.includes('what is')
    )
      return 'explain';
    if (
      prompt.includes('write') ||
      prompt.includes('draft') ||
      prompt.includes('create')
    )
      return 'write';
    if (prompt.includes('analyz') || prompt.includes('evaluat'))
      return 'analyze';
    if (prompt.includes('plan') || prompt.includes('strateg')) return 'plan';
    if (
      prompt.includes('debug') ||
      prompt.includes('fix') ||
      prompt.includes('troubleshoot')
    )
      return 'debug';
    if (prompt.includes('optimize') || prompt.includes('improve'))
      return 'optimize';
    if (prompt.includes('summariz') || prompt.includes('review'))
      return 'summarize';
    return 'general';
  };

  const generateAspectTitle = (type) => {
    const titles = {
      compare: 'What comparison criteria matter most?',
      explain: 'What should the explanation focus on?',
      write: 'What elements should the content include?',
      analyze: 'What should the analysis prioritize?',
      plan: 'What should the plan emphasize?',
      debug: 'What context helps solve this?',
      optimize: 'What should be optimized for?',
      summarize: 'What details should be highlighted?',
      general: 'What specific aspects matter most?',
    };
    return titles[type];
  };

  const generateAspectDescription = (type, topic) => {
    const descriptions = {
      compare: `When comparing options for "${topic}", which criteria are most important to you?`,
      explain: `When explaining "${topic}", what aspects should be covered in detail?`,
      write: `When writing about "${topic}", what key elements must be included?`,
      analyze: `When analyzing "${topic}", what factors should be examined closely?`,
      plan: `When planning "${topic}", what considerations are most critical?`,
      debug: `To help debug "${topic}", what additional context would be useful?`,
      optimize: `When optimizing "${topic}", what are your priority goals?`,
      summarize: `When summarizing "${topic}", what information is most valuable?`,
      general: `For "${topic}", what particular aspects should be emphasized?`,
    };
    return descriptions[type];
  };

  const generateBackgroundTitle = (type) => {
    const titles = {
      compare: 'How familiar are you with these options?',
      explain: "What's your current understanding?",
      write: 'Who is the target audience?',
      analyze: "What's your analysis skill level?",
      plan: "What's your planning experience?",
      debug: "What's your technical background?",
      optimize: "What's your optimization experience?",
      summarize: 'How deep should the summary be?',
      general: "What's your background level?",
    };
    return titles[type];
  };

  const generateBackgroundDescription = (type, topic) => {
    const descriptions = {
      compare:
        'Understanding your familiarity helps provide the right level of detail in the comparison.',
      explain:
        'Knowing your current knowledge helps pitch the explanation at the right level.',
      write:
        'Understanding the audience helps set the appropriate tone and complexity.',
      analyze:
        'Your background helps determine the depth and rigor of the analysis.',
      plan: 'Your experience level helps shape the detail and guidance in the plan.',
      debug:
        'Your technical level helps provide appropriate troubleshooting steps.',
      optimize:
        'Your experience helps determine which optimization strategies to suggest.',
      summarize:
        'This helps determine how technical or simplified the summary should be.',
      general:
        'Your knowledge level helps tailor the complexity and depth of the response.',
    };
    return descriptions[type];
  };

  const generateUseTitle = (type) => {
    const titles = {
      compare: 'What decision are you making?',
      explain: 'Why do you need to understand this?',
      write: 'Where will this be used?',
      analyze: 'What will you do with the analysis?',
      plan: "What's the plan's purpose?",
      debug: "What's your goal with the fix?",
      optimize: "What's driving the optimization?",
      summarize: 'How will you use the summary?',
      general: "What's your intended use?",
    };
    return titles[type];
  };

  const generateUseDescription = (type) => {
    const descriptions = {
      compare:
        'Understanding your decision context helps provide relevant comparison criteria.',
      explain:
        'Knowing your purpose helps structure the explanation appropriately.',
      write:
        'The context helps determine format, style, and content priorities.',
      analyze: 'The end goal helps focus the analysis on actionable insights.',
      plan: 'Understanding the purpose helps create a practical, focused plan.',
      debug: 'Your goal helps prioritize the most effective solutions.',
      optimize: 'The driver helps focus on the right optimization targets.',
      summarize: 'The use case helps determine what information to prioritize.',
      general: "How you'll use this helps determine the format and focus.",
    };
    return descriptions[type];
  };

  const generateAspectExamples = (prompt) => {
    if (prompt.includes('compar')) {
      return [
        'Focus on practical differences and real-world implications',
        'Emphasize pros and cons of each option',
        'Highlight cost and performance trade-offs',
        'Include specific use cases for each',
      ];
    } else if (prompt.includes('explain') || prompt.includes('how')) {
      return [
        'Focus on step-by-step explanation',
        'Include real-world examples and analogies',
        'Emphasize common pitfalls and best practices',
        'Show practical implementation details',
      ];
    } else if (prompt.includes('write') || prompt.includes('create')) {
      return [
        'Focus on structure and formatting',
        'Emphasize tone and style guidelines',
        'Include specific examples and templates',
        'Highlight key elements to include',
      ];
    } else if (prompt.includes('analyz')) {
      return [
        'Focus on methodology and framework',
        'Emphasize data-driven insights',
        'Include specific metrics and KPIs',
        'Highlight actionable recommendations',
      ];
    } else {
      return [
        'Focus on practical application',
        'Emphasize key concepts and principles',
        'Include relevant examples',
        'Highlight important considerations',
      ];
    }
  };

  const generateBackgroundExamples = (prompt, topic) => {
    const shortTopic = topic.length > 30 ? 'this topic' : topic;
    return [
      `I'm a complete beginner with ${shortTopic}`,
      `I have basic familiarity with ${shortTopic}`,
      `I'm experienced with ${shortTopic} and want advanced details`,
    ];
  };

  const generateUseExamples = (prompt) => {
    if (prompt.includes('write') || prompt.includes('create')) {
      return [
        'I need to write this myself',
        'I need to present this to stakeholders',
        "I'm building a proof of concept",
      ];
    } else if (prompt.includes('learn') || prompt.includes('understand')) {
      return [
        "I'm learning this for personal knowledge",
        'I need to teach this to others',
        "I'm preparing for a project or interview",
      ];
    } else {
      return [
        'I need to make a decision based on this',
        "I'm doing research for a project",
        'I need to explain this to my team',
      ];
    }
  };

  const extractTopic = (prompt) => {
    // Extract key topic from prompt - improved version
    const trimmed = prompt.trim();

    // If it's short enough, use it as-is
    if (trimmed.length <= 50) {
      return trimmed;
    }

    // Try to extract the main topic intelligently
    const lowerPrompt = trimmed.toLowerCase();

    // Remove common prompt starters
    const starters = [
      'please ',
      'can you ',
      'could you ',
      'i want to ',
      'i need to ',
      'help me ',
      'write ',
      'create ',
      'explain ',
      'analyze ',
      'compare ',
    ];
    let topic = trimmed;

    for (const starter of starters) {
      if (lowerPrompt.startsWith(starter)) {
        topic = trimmed.slice(starter.length);
        break;
      }
    }

    // Truncate if still too long
    if (topic.length > 60) {
      topic = topic.slice(0, 57) + '...';
    }

    return topic;
  };

  const toggleSection = (id) => {
    setExpandedSection(expandedSection === id ? null : id);
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleExampleClick = (field, example) => {
    setFormData((prev) => ({ ...prev, [field]: example }));
  };

  const handleSubmit = () => {
    // Build enhanced prompt with context
    let enhancedPrompt = initialPrompt;

    if (formData.specificAspects) {
      enhancedPrompt += `\n\nSpecific Focus: ${formData.specificAspects}`;
    }
    if (formData.backgroundLevel) {
      enhancedPrompt += `\n\nAudience Level: ${formData.backgroundLevel}`;
    }
    if (formData.intendedUse) {
      enhancedPrompt += `\n\nIntended Use: ${formData.intendedUse}`;
    }

    onComplete(enhancedPrompt, formData);
  };

  const isComplete =
    formData.specificAspects ||
    formData.backgroundLevel ||
    formData.intendedUse;

  return (
    <div className="mx-auto w-full max-w-2xl rounded-lg border-2 border-gray-800 bg-white shadow-lg">
      <div className="border-b-2 border-gray-800 p-6">
        <h2 className="mb-2 text-2xl font-bold">Improve Your Prompt</h2>
        <p className="text-gray-600">
          {isLoadingQuestions
            ? 'Generating context-aware questions...'
            : 'Answer these questions to get better results!'}
        </p>
      </div>

      <div className="space-y-4 p-6">
        {isLoadingQuestions ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="mb-4 h-8 w-8 animate-spin text-blue-600" />
            <p className="text-gray-600">Analyzing your prompt...</p>
          </div>
        ) : error ? (
          <div className="py-8 text-center">
            <p className="mb-4 text-red-600">
              Failed to generate custom questions
            </p>
            <p className="text-sm text-gray-500">
              Using fallback questions instead
            </p>
          </div>
        ) : null}

        {!isLoadingQuestions && questions.length > 0 && (
          <>
            {questions.map((question) => (
              <div
                key={question.id}
                className="overflow-hidden rounded-lg border-2 border-gray-800"
              >
                <button
                  onClick={() => toggleSection(question.id)}
                  className="flex w-full items-start gap-3 p-4 transition-colors hover:bg-gray-50"
                >
                  <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gray-800 font-bold text-white">
                    {question.id}
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-lg font-semibold">{question.title}</h3>
                  </div>
                  {expandedSection === question.id ? (
                    <ChevronUp className="mt-1 h-5 w-5 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="mt-1 h-5 w-5 flex-shrink-0" />
                  )}
                </button>

                {expandedSection === question.id && (
                  <div className="border-t border-gray-200 p-4 pt-0">
                    <p className="mb-4 ml-10 text-sm text-gray-600">
                      {question.description}
                    </p>

                    <div className="ml-10">
                      <textarea
                        value={formData[question.field]}
                        onChange={(e) =>
                          handleInputChange(question.field, e.target.value)
                        }
                        placeholder="Type your answer here..."
                        className="w-full resize-none rounded-lg border-2 border-gray-300 p-3 focus:border-blue-500 focus:outline-none"
                        rows={3}
                      />

                      <div className="mt-4">
                        <p className="mb-2 text-sm font-medium text-gray-700">
                          Examples
                        </p>
                        <div className="space-y-2">
                          {question.examples.map((example, idx) => (
                            <button
                              key={idx}
                              onClick={() =>
                                handleExampleClick(question.field, example)
                              }
                              className="group flex w-full items-center justify-between rounded-lg border-2 border-gray-300 p-3 text-left text-sm transition-colors hover:border-gray-400 hover:bg-gray-50"
                            >
                              <span className="flex-1">{example}</span>
                              <Plus className="h-4 w-4 flex-shrink-0 text-gray-400 group-hover:text-gray-600" />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {!isLoadingQuestions && (
          <div className="pt-4">
            <button
              onClick={handleSubmit}
              disabled={!isComplete}
              className={`w-full rounded-lg px-6 py-3 font-semibold transition-colors ${
                isComplete
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'cursor-not-allowed bg-gray-200 text-gray-400'
              }`}
            >
              {isComplete
                ? 'Optimize with Context'
                : 'Answer at least one question to continue'}
            </button>

            <button
              onClick={() => onComplete(initialPrompt, {})}
              className="mt-2 w-full py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Skip and optimize without context
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PromptImprovementForm;
