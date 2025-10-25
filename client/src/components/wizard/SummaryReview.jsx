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
      title: 'Creative Brief',
      icon: '🎬',
      color: 'indigo',
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
    <div className={`${isMobile ? 'px-4 py-6' : 'max-w-4xl mx-auto px-8 py-8'}`}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <FileText className="w-6 h-6 text-green-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Review Your Prompt</h2>
        </div>
        <p className="text-gray-600 text-lg">
          Check everything before generating your video prompt.
        </p>
      </div>

      {/* Completion Score */}
      <div className="mb-6 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border-2 border-indigo-200">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-semibold text-gray-700">Completion Score</span>
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${
              qualityBadge.color === 'green' ? 'bg-green-100 text-green-700' :
              qualityBadge.color === 'blue' ? 'bg-blue-100 text-blue-700' :
              qualityBadge.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              {qualityBadge.text}
            </span>
          </div>
          <span className="text-2xl font-bold text-indigo-600">{completionScore}%</span>
        </div>
        <div className="w-full bg-white rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${
              completionScore >= 80 ? 'bg-green-500' :
              completionScore >= 50 ? 'bg-yellow-500' :
              'bg-red-500'
            }`}
            style={{ width: `${completionScore}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-gray-600">
          {completionScore >= 80 ? 'Excellent! Your prompt is well-detailed.' :
           completionScore >= 50 ? 'Good! Consider adding more atmosphere details.' :
           'Add more details for better results.'}
        </p>
      </div>

      {/* Generated Prompt Preview */}
      <div className="mb-8 p-6 bg-white border-2 border-gray-200 rounded-xl shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <h3 className="font-semibold text-gray-900">Generated Prompt</h3>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopy}
              className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              title="Copy to clipboard"
            >
              {copied ? <CheckCircle className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
            </button>
            <button
              onClick={handleDownload}
              className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              title="Download as text"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
            {generatedPrompt || 'Fill in the core concept fields to see your prompt preview...'}
          </p>
        </div>

        <div className="mt-3 flex items-center justify-between text-sm">
          <span className={`font-medium ${
            wordCount >= 75 && wordCount <= 125 ? 'text-green-600' :
            wordCount > 125 ? 'text-yellow-600' :
            'text-gray-600'
          }`}>
            {wordCount} words
          </span>
          <span className="text-gray-500">
            Target: 75-125 words
          </span>
        </div>
      </div>

      {/* Field Review Sections */}
      <div className="space-y-6 mb-8">
        {sections.map((section) => {
          const filledFields = section.fields.filter(f => formData[f.key]);
          const missingRequired = section.fields.filter(f => f.required && !formData[f.key]);

          return (
            <div key={section.title} className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden">
              {/* Section Header */}
              <div className={`px-5 py-3 bg-${section.color}-50 border-b border-${section.color}-200`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-xl">{section.icon}</span>
                    <h3 className="font-semibold text-gray-900">{section.title}</h3>
                  </div>
                  <button
                    onClick={() => onEdit(section.step)}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center"
                  >
                    <Edit2 className="w-4 h-4 mr-1" />
                    Edit
                  </button>
                </div>
              </div>

              {/* Section Fields */}
              <div className="px-5 py-4 space-y-3">
                {section.fields.map((field) => (
                  <div key={field.key} className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-700 mb-1">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </p>
                      {formData[field.key] ? (
                        <p className="text-sm text-gray-900">{formData[field.key]}</p>
                      ) : (
                        <p className="text-sm text-gray-400 italic">
                          {field.required ? 'Required - not filled' : 'Not specified'}
                        </p>
                      )}
                    </div>
                    {formData[field.key] && (
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 ml-2" />
                    )}
                    {field.required && !formData[field.key] && (
                      <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 ml-2" />
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

      {/* Action Buttons */}
      <div className={`flex ${isMobile ? 'flex-col space-y-3' : 'justify-between items-center'}`}>
        <button
          onClick={onBack}
          className="px-6 py-3 rounded-lg font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all duration-200"
        >
          Back to Technical Specs
        </button>

        <button
          onClick={onGenerate}
          disabled={!formData.subject || !formData.action || !formData.location}
          className={`
            ${isMobile ? 'w-full' : 'px-12'}
            py-4 rounded-xl font-bold text-lg
            transition-all duration-200
            ${formData.subject && formData.action && formData.location
              ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 hover:shadow-2xl active:scale-95'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          <div className="flex items-center justify-center space-x-2">
            <Sparkles className="w-6 h-6" />
            <span>Generate Video Prompt</span>
          </div>
        </button>
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
