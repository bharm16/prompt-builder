import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { FileText, Edit2, Download, Copy, CheckCircle, AlertTriangle, Sparkles } from 'lucide-react';
import { aiWizardService } from '../../services/aiWizardService';

/**
 * SummaryReview Component
 *
 * Final review screen before generating:
 * - Display all entered values grouped by step
 * - Show generated prompt preview
 * - Edit links next to each field
 * - Highlight missing required fields
 * - Word count indicator (target: 75-125 words)
 * - Download/copy options
 * - Big "Generate Video Prompt" CTA
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

  // Get qualitative badge based on completion score
  const getQualityBadge = (score) => {
    if (score >= 80) return { text: 'Excellent Prompt!', color: 'green' };
    if (score >= 60) return { text: 'Good Detail', color: 'blue' };
    if (score >= 40) return { text: 'Solid Start', color: 'yellow' };
    return { text: 'Needs More Detail', color: 'red' };
  };

  const qualityBadge = getQualityBadge(completionScore);

  // Field sections for review
  const sections = [
    {
      title: 'Core Concept',
      icon: '🎬',
      color: 'indigo',
      fields: [
        { key: 'subject', label: 'Subject', required: true },
        { key: 'action', label: 'Action', required: true },
        { key: 'descriptor1', label: 'Descriptor 1', required: false },
        { key: 'descriptor2', label: 'Descriptor 2', required: false },
        { key: 'descriptor3', label: 'Descriptor 3', required: false }
      ],
      step: 1 // Core Concept is now step 1
    },
    {
      title: 'Atmosphere & Style',
      icon: '✨',
      color: 'purple',
      fields: [
        { key: 'location', label: 'Location', required: false },
        { key: 'time', label: 'Time', required: false },
        { key: 'mood', label: 'Mood', required: false },
        { key: 'style', label: 'Style', required: false },
        { key: 'event', label: 'Event', required: false }
      ],
      step: 2 // Atmosphere is now step 2
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
    <div className={`${isMobile ? 'px-4 py-6' : 'max-w-5xl mx-auto px-8 py-12'} animate-fade-slide-in`}>
      {/* Celebration Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-100 mb-4 animate-scale-in">
          <Sparkles className="w-10 h-10 text-emerald-600" />
        </div>
        <h2 className="text-4xl font-bold text-neutral-900 mb-3 tracking-tight">
          Looking great! Here's your video concept
        </h2>
        <p className="text-neutral-600 text-lg max-w-2xl mx-auto leading-relaxed">
          Review your selections below. You can edit any section or generate your optimized prompt right away.
        </p>
      </div>

      {/* Completion Metrics */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        <div className="text-center p-6 bg-gradient-to-br from-brand-primary-50 to-brand-primary-100/50 rounded-xl shadow-card">
          <div className="text-4xl font-bold text-brand-primary-700">{completionScore}%</div>
          <div className="text-sm text-brand-primary-700/80 mt-1.5 font-medium">Complete</div>
        </div>
        <div className="text-center p-6 bg-gradient-to-br from-neutral-50 to-neutral-100 rounded-xl shadow-card">
          <div className="text-4xl font-bold text-neutral-700">{wordCount}</div>
          <div className="text-sm text-neutral-600 mt-1.5 font-medium">Words</div>
        </div>
        <div className="text-center p-6 bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-xl shadow-card">
          <div className="text-4xl font-bold text-emerald-700">
            {sections.reduce((acc, s) => acc + s.fields.filter(f => formData[f.key]).length, 0)}/{sections.reduce((acc, s) => acc + s.fields.length, 0)}
          </div>
          <div className="text-sm text-emerald-700/80 mt-1.5 font-medium">Fields</div>
        </div>
      </div>

      {/* Generated Prompt Preview */}
      <div className="mb-10 p-8 bg-white rounded-xl shadow-card-hover border border-neutral-200 hover-lift">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center space-x-2.5">
            <Sparkles className="w-6 h-6 text-brand-primary-600" />
            <h3 className="text-xl font-bold text-neutral-900">Your Generated Prompt</h3>
          </div>
          <div className="flex items-center space-x-2.5">
            <button
              onClick={handleCopy}
              className="p-2.5 text-neutral-600 hover:text-brand-primary-600 hover:bg-brand-primary-50 rounded-xl transition-all hover-lift"
              title="Copy to clipboard"
            >
              {copied ? <CheckCircle className="w-5 h-5 text-emerald-600 animate-scale-in" /> : <Copy className="w-5 h-5" />}
            </button>
            <button
              onClick={handleDownload}
              className="p-2.5 text-neutral-600 hover:text-brand-primary-600 hover:bg-brand-primary-50 rounded-xl transition-all hover-lift"
              title="Download as text"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 bg-neutral-50 rounded-xl border border-neutral-200">
          <p className="text-neutral-900 text-base leading-relaxed whitespace-pre-wrap">
            {generatedPrompt || 'Fill in the core concept fields to see your prompt preview...'}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm">
          <span className={`font-semibold ${
            wordCount >= 75 && wordCount <= 125 ? 'text-emerald-600' :
            wordCount > 125 ? 'text-warning-600' :
            'text-neutral-600'
          }`}>
            {wordCount} words
          </span>
          <span className="text-neutral-500 font-medium">
            Target: 75-125 words
          </span>
        </div>
      </div>

      {/* Field Review Sections */}
      <div className="space-y-6 mb-10">
        {sections.map((section) => {
          const filledFields = section.fields.filter(f => formData[f.key]);
          const missingRequired = section.fields.filter(f => f.required && !formData[f.key]);

          return (
            <div key={section.title} className="bg-white rounded-xl shadow-card border border-neutral-200 overflow-hidden animate-slide-in-from-bottom hover-lift">
              {/* Section Header */}
              <div className="px-6 py-4 bg-gradient-to-r from-brand-primary-50 to-brand-primary-100/50 border-b border-brand-primary-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-brand-primary-100">
                      <span className="text-xl">{section.icon}</span>
                    </div>
                    <h3 className="text-lg font-bold text-neutral-900">{section.title}</h3>
                  </div>
                  <button
                    onClick={() => onEdit(section.step)}
                    className="flex items-center space-x-2 px-4 py-2 text-sm font-semibold text-brand-primary-700 bg-brand-primary-50 hover:bg-brand-primary-100 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span>Edit</span>
                  </button>
                </div>
              </div>

              {/* Section Fields */}
              <div className="px-6 py-5 space-y-4">
                {section.fields.map((field) => (
                  <div key={field.key} className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-neutral-700 mb-1.5">
                        {field.label}
                        {field.required && <span className="text-error-500 ml-1">*</span>}
                      </p>
                      {formData[field.key] ? (
                        <p className="text-base text-neutral-900 leading-relaxed">{formData[field.key]}</p>
                      ) : (
                        <p className="text-sm text-neutral-400 italic">
                          {field.required ? 'Required - not filled' : 'Not specified'}
                        </p>
                      )}
                    </div>
                    {formData[field.key] && (
                      <CheckCircle className="w-6 h-6 text-emerald-500 flex-shrink-0 ml-3" />
                    )}
                    {field.required && !formData[field.key] && (
                      <AlertTriangle className="w-6 h-6 text-error-500 flex-shrink-0 ml-3" />
                    )}
                  </div>
                ))}

                {missingRequired.length > 0 && (
                  <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-sm text-red-800">
                      <AlertTriangle className="w-4 h-4 inline mr-1" />
                      Missing required fields: {missingRequired.map(f => f.label).join(', ')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Technical Parameters Section */}
        {hasTechnicalParams && (
          <div className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 bg-blue-50 border-b border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-xl">⚙️</span>
                  <h3 className="font-semibold text-gray-900">Technical Specs</h3>
                </div>
                <button
                  onClick={() => onEdit(1)}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center"
                >
                  <Edit2 className="w-4 h-4 mr-1" />
                  Edit
                </button>
              </div>
            </div>

            <div className="px-5 py-4 space-y-3">
              {technicalCategories.map((category) => {
                const categoryData = formData[category.key];
                if (!categoryData || Object.keys(categoryData).length === 0) return null;

                return (
                  <div key={category.key}>
                    <p className="text-sm font-semibold text-gray-700 mb-2">{category.label}</p>
                    <div className="pl-4 space-y-1">
                      {Object.entries(categoryData).map(([key, value]) => (
                        value && (
                          <p key={key} className="text-sm text-gray-600">
                            <span className="font-medium capitalize">{key}:</span> {value}
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

      {/* Enhanced CTA Section */}
      <div className="sticky bottom-0 -mx-8 -mb-12 p-8 bg-gradient-to-t from-neutral-50 via-neutral-50 to-transparent pt-20">
        <div className={`flex ${isMobile ? 'flex-col space-y-4' : 'justify-between items-center'}`}>
          <button
            onClick={onBack}
            className="px-6 py-3 rounded-xl font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 transition-all hover-lift"
          >
            Back to Technical Specs
          </button>

          <button
            onClick={onGenerate}
            disabled={!formData.subject || !formData.action || !formData.location}
            className={`
              ${isMobile ? 'w-full' : 'px-12'}
              py-5 rounded-xl font-bold text-lg shadow-xl
              transition-all duration-200 flex items-center justify-center space-x-3
              ${formData.subject && formData.action && formData.location
                ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98]'
                : 'bg-neutral-300 text-neutral-500 cursor-not-allowed shadow-none'
              }
            `}
          >
            <Sparkles className="w-6 h-6" />
            <span>Generate Your Optimized Prompt</span>
          </button>
        </div>
        {formData.subject && formData.action && formData.location && (
          <p className="text-center text-sm text-neutral-600 mt-4">
            This will create a prompt optimized for all major AI video models
          </p>
        )}
      </div>

      {/* Missing Requirements Warning */}
      {(!formData.subject || !formData.action || !formData.location) && (
        <div className="mt-6 p-4 bg-red-50 rounded-lg border border-red-200">
          <p className="text-sm text-red-800">
            <AlertTriangle className="w-4 h-4 inline mr-1" />
            Please fill in all required fields (Subject, Action, Location) before generating.
          </p>
        </div>
      )}
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
