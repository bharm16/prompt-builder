import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { FileText, Edit2, Download, Copy, CheckCircle, AlertTriangle, Sparkles } from 'lucide-react';
import { aiWizardService } from '../../services/aiWizardService';

/**
 * SummaryReview Component (2025 Design System)
 *
 * Final review screen with modern, clean aesthetics:
 * - Neutral + emerald color palette only
 * - Simplified cards without gradients
 * - Consistent border styling (1px neutral-200)
 * - Clean metric displays
 * - Accessible contrast ratios
 * - No custom animation classes (inline transitions)
 * - System font stack throughout
 */
const SummaryReview = ({
  formData,
  onEdit,
  onGenerate,
  onBack,
  isMobile
}) => {
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [completionScore, setCompletionScore] = useState(0);

  // Generate prompt preview
  useEffect(() => {
    const prompt = aiWizardService.generatePrompt(formData);
    setGeneratedPrompt(prompt);
    setWordCount(prompt.split(/\s+/).filter(w => w.length > 0).length);
    setCompletionScore(aiWizardService.getCompletionPercentage(formData));
  }, [formData]);

  // Copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Download as text file
  const handleDownload = () => {
    const blob = new Blob([generatedPrompt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'video-prompt.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Field sections for review
  const sections = [
    {
      title: 'Creative Brief',
      icon: '🎬',
      fields: [
        { key: 'subject', label: 'Subject', required: true },
        { key: 'action', label: 'Action', required: true },
        { key: 'location', label: 'Location', required: true },
        { key: 'time', label: 'Time', required: false },
        { key: 'mood', label: 'Mood', required: false },
        { key: 'style', label: 'Style', required: false },
        { key: 'event', label: 'Event', required: false }
      ],
      step: 0
    }
  ];

  // Check if technical parameters exist
  const hasTechnicalParams = formData.camera || formData.lighting || formData.composition || formData.motion || formData.effects;
  const technicalCategories = [
    { key: 'camera', label: 'Camera Settings' },
    { key: 'lighting', label: 'Lighting' },
    { key: 'composition', label: 'Composition' },
    { key: 'motion', label: 'Motion & Pace' },
    { key: 'effects', label: 'Effects & Style' }
  ];

  return (
    <div
      className={`${isMobile ? 'px-4 py-6' : 'max-w-5xl mx-auto px-8 py-12'}`}
      style={{
        animation: 'fadeIn 0.4s ease-out'
      }}
    >
      {/* Clean Header */}
      <div className="text-center mb-12">
        <div
          className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-50 mb-5"
          style={{
            animation: 'scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}
        >
          <Sparkles className="w-10 h-10 text-emerald-600" />
        </div>
        <h2 className="text-4xl font-bold text-neutral-900 mb-3 tracking-tight">
          Looking great! Here's your video concept
        </h2>
        <p className="text-neutral-600 text-lg max-w-2xl mx-auto leading-relaxed">
          Review your selections below. You can edit any section or generate your optimized prompt right away.
        </p>
      </div>

      {/* Simplified Completion Metrics */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        {/* Completion Score */}
        <div className="text-center p-6 bg-neutral-50 rounded-xl border border-neutral-200 transition-all duration-200 hover:border-neutral-300 hover:shadow-sm">
          <div className="text-4xl font-bold text-neutral-900">{completionScore}%</div>
          <div className="text-sm text-neutral-600 mt-2 font-medium">Complete</div>
        </div>

        {/* Word Count */}
        <div className="text-center p-6 bg-neutral-50 rounded-xl border border-neutral-200 transition-all duration-200 hover:border-neutral-300 hover:shadow-sm">
          <div className="text-4xl font-bold text-neutral-900">{wordCount}</div>
          <div className="text-sm text-neutral-600 mt-2 font-medium">Words</div>
        </div>

        {/* Fields Filled */}
        <div className="text-center p-6 bg-emerald-50 rounded-xl border border-emerald-200 transition-all duration-200 hover:border-emerald-300 hover:shadow-sm">
          <div className="text-4xl font-bold text-emerald-700">
            {sections.reduce((acc, s) => acc + s.fields.filter(f => formData[f.key]).length, 0)}/{sections.reduce((acc, s) => acc + s.fields.length, 0)}
          </div>
          <div className="text-sm text-emerald-700 mt-2 font-medium">Fields</div>
        </div>
      </div>

      {/* Generated Prompt Preview - Clean Design */}
      <div className="mb-10 p-8 bg-white rounded-xl border border-neutral-200 transition-all duration-200 hover:border-neutral-300 hover:shadow-md">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Sparkles className="w-6 h-6 text-emerald-600" />
            <h3 className="text-xl font-bold text-neutral-900">Your Generated Prompt</h3>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopy}
              className="p-2.5 text-neutral-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all duration-200"
              title="Copy to clipboard"
            >
              {copied ? (
                <CheckCircle
                  className="w-5 h-5 text-emerald-600"
                  style={{ animation: 'scaleIn 0.3s ease-out' }}
                />
              ) : (
                <Copy className="w-5 h-5" />
              )}
            </button>
            <button
              onClick={handleDownload}
              className="p-2.5 text-neutral-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all duration-200"
              title="Download as text"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Prompt Display - Matches PromptCanvas styling */}
        <div className="p-6 bg-neutral-50 rounded-lg border border-neutral-200">
          <p className="text-neutral-900 text-base leading-relaxed whitespace-pre-wrap font-normal">
            {generatedPrompt || 'Fill in the core concept fields to see your prompt preview...'}
          </p>
        </div>

        {/* Word Count Indicator */}
        <div className="mt-5 flex items-center justify-between text-sm">
          <span className={`font-semibold px-3 py-1.5 rounded-md ${
            wordCount >= 75 && wordCount <= 125
              ? 'bg-emerald-50 text-emerald-700'
              : wordCount > 125
              ? 'bg-amber-50 text-amber-700'
              : 'bg-neutral-100 text-neutral-600'
          }`}>
            {wordCount} words
          </span>
          <span className="text-neutral-500 font-medium">
            Target: 75-125 words
          </span>
        </div>
      </div>

      {/* Field Review Sections - Simplified Design */}
      <div className="space-y-6 mb-10">
        {sections.map((section, idx) => {
          const filledFields = section.fields.filter(f => formData[f.key]);
          const missingRequired = section.fields.filter(f => f.required && !formData[f.key]);

          return (
            <div
              key={section.title}
              className="bg-white rounded-xl border border-neutral-200 overflow-hidden transition-all duration-200 hover:border-neutral-300 hover:shadow-md"
              style={{
                animation: `slideUp 0.4s ease-out ${idx * 0.1}s both`
              }}
            >
              {/* Section Header - Clean Neutral Design */}
              <div className="px-6 py-5 bg-neutral-50 border-b border-neutral-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-neutral-100">
                      <span className="text-xl">{section.icon}</span>
                    </div>
                    <h3 className="text-lg font-bold text-neutral-900">{section.title}</h3>
                  </div>
                  <button
                    onClick={() => onEdit(section.step)}
                    className="flex items-center space-x-2 px-4 py-2 text-sm font-semibold text-neutral-700 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-lg transition-all duration-200"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span>Edit</span>
                  </button>
                </div>
              </div>

              {/* Section Fields */}
              <div className="px-6 py-6 space-y-5">
                {section.fields.map((field) => (
                  <div key={field.key} className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-neutral-700 mb-2">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </p>
                      {formData[field.key] ? (
                        <p className="text-base text-neutral-900 leading-relaxed break-words">
                          {formData[field.key]}
                        </p>
                      ) : (
                        <p className="text-sm text-neutral-400 italic">
                          {field.required ? 'Required - not filled' : 'Not specified'}
                        </p>
                      )}
                    </div>
                    <div className="flex-shrink-0 pt-0.5">
                      {formData[field.key] && (
                        <CheckCircle className="w-6 h-6 text-emerald-500" />
                      )}
                      {field.required && !formData[field.key] && (
                        <AlertTriangle className="w-6 h-6 text-red-500" />
                      )}
                    </div>
                  </div>
                ))}

                {/* Missing Required Warning - Softer Design */}
                {missingRequired.length > 0 && (
                  <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-start space-x-2">
                      <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-800 leading-relaxed">
                        Missing required fields: <span className="font-semibold">{missingRequired.map(f => f.label).join(', ')}</span>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Technical Parameters Section - Modernized */}
        {hasTechnicalParams && (
          <div
            className="bg-white rounded-xl border border-neutral-200 overflow-hidden transition-all duration-200 hover:border-neutral-300 hover:shadow-md"
            style={{
              animation: 'slideUp 0.4s ease-out 0.1s both'
            }}
          >
            <div className="px-6 py-5 bg-neutral-50 border-b border-neutral-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-neutral-100">
                    <span className="text-xl">⚙️</span>
                  </div>
                  <h3 className="text-lg font-bold text-neutral-900">Technical Specs</h3>
                </div>
                <button
                  onClick={() => onEdit(1)}
                  className="flex items-center space-x-2 px-4 py-2 text-sm font-semibold text-neutral-700 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-lg transition-all duration-200"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>Edit</span>
                </button>
              </div>
            </div>

            <div className="px-6 py-6 space-y-5">
              {technicalCategories.map((category) => {
                const categoryData = formData[category.key];
                if (!categoryData || Object.keys(categoryData).length === 0) return null;

                return (
                  <div key={category.key}>
                    <p className="text-sm font-semibold text-neutral-700 mb-3">{category.label}</p>
                    <div className="pl-4 space-y-2">
                      {Object.entries(categoryData).map(([key, value]) => (
                        value && (
                          <p key={key} className="text-sm text-neutral-900 leading-relaxed">
                            <span className="font-semibold capitalize text-neutral-700">{key}:</span> {value}
                          </p>
                        )
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* CTA Section - Clean Gradient Design */}
      <div className="sticky bottom-0 -mx-8 -mb-12 p-8 bg-gradient-to-t from-white via-white to-transparent pt-16 border-t border-neutral-100">
        <div className={`flex ${isMobile ? 'flex-col space-y-4' : 'justify-between items-center'}`}>
          <button
            onClick={onBack}
            className="px-6 py-3 rounded-xl font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 transition-all duration-200"
          >
            Back to Technical Specs
          </button>

          <button
            onClick={onGenerate}
            disabled={!formData.subject || !formData.action || !formData.location}
            className={`
              ${isMobile ? 'w-full' : 'px-12'}
              py-5 rounded-xl font-bold text-lg shadow-lg
              transition-all duration-200 flex items-center justify-center space-x-3
              ${formData.subject && formData.action && formData.location
                ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]'
                : 'bg-neutral-200 text-neutral-500 cursor-not-allowed shadow-none border border-neutral-300'
              }
            `}
          >
            <Sparkles className="w-6 h-6" />
            <span>Generate Your Optimized Prompt</span>
          </button>
        </div>
        {formData.subject && formData.action && formData.location && (
          <p className="text-center text-sm text-neutral-600 mt-5 font-medium">
            This will create a prompt optimized for all major AI video models
          </p>
        )}
      </div>

      {/* Missing Requirements Warning - Softer Design */}
      {(!formData.subject || !formData.action || !formData.location) && (
        <div className="mt-6 p-5 bg-amber-50 rounded-xl border border-amber-200">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-900 leading-relaxed">
              Please fill in all required fields <span className="font-semibold">(Subject, Action, Location)</span> before generating your prompt.
            </p>
          </div>
        </div>
      )}

      {/* Inline Keyframes */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

SummaryReview.propTypes = {
  formData: PropTypes.object.isRequired,
  onEdit: PropTypes.func.isRequired,
  onGenerate: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired,
  isMobile: PropTypes.bool
};

SummaryReview.defaultProps = {
  isMobile: false
};

export default SummaryReview;
