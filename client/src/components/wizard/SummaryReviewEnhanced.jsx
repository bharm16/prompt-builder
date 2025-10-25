import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Edit2, Sparkles, ArrowRight, Film, Clapperboard, Copy, CheckCircle, Download } from 'lucide-react';
import { cn } from '../../utils/cn';
import { aiWizardService } from '../../services/aiWizardService';

/**
 * SummaryReview Component - Enhanced Design
 * 
 * Celebration-focused final review with metrics, preview, and edit capabilities
 */
const SummaryReviewEnhanced = ({
  formData,
  onEdit,
  onGenerate,
  onBack
}) => {
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [completionScore, setCompletionScore] = useState(0);
  const [copied, setCopied] = useState(false);
  
  const targetWordCount = { min: 75, max: 125 };
  
  // Generate prompt and calculate metrics
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
  
  // Calculate fields completed
  const allFields = ['subject', 'action', 'location', 'time', 'mood', 'style', 'event'];
  const completedFields = allFields.filter(field => formData[field]).length;
  
  // Sections for display
  const sections = [
    {
      id: 'creative',
      title: 'Creative Brief',
      icon: <Film className="w-5 h-5 text-accent-600" />,
      fields: [
        { key: 'subject', label: 'Focus' },
        { key: 'action', label: 'Action' },
        { key: 'location', label: 'Location' },
        { key: 'time', label: 'Time' },
        { key: 'mood', label: 'Mood' },
        { key: 'style', label: 'Style' },
        { key: 'event', label: 'Event' }
      ]
    }
  ];
  
  // Add technical section if technical params exist
  if (formData.camera || formData.lighting || formData.composition || formData.motion || formData.effects) {
    sections.push({
      id: 'technical',
      title: 'Technical Specifications',
      icon: <Clapperboard className="w-5 h-5 text-accent-600" />,
      fields: [
        { key: 'camera.angle', label: 'Camera Angle' },
        { key: 'camera.distance', label: 'Distance' },
        { key: 'camera.movement', label: 'Movement' },
        { key: 'lighting.quality', label: 'Lighting' },
        { key: 'composition.framing', label: 'Framing' },
        { key: 'motion.speed', label: 'Motion Speed' },
        { key: 'effects.colorGrading', label: 'Color Grading' }
      ]
    });
  }
  
  // Get nested value
  const getValue = (obj, path) => {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  };
  
  return (
    <div className="max-w-4xl mx-auto px-8 py-12 animate-fade-in">
      <div className="space-y-10">
        {/* Celebration Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-2 animate-scale-in-bounce">
            <Sparkles className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-3xl font-bold text-neutral-900">
            Looking great! Here's your video concept
          </h2>
          <p className="text-lg text-neutral-600 max-w-2xl mx-auto leading-relaxed">
            Review your selections below. You can edit any section or generate 
            your optimized prompt right away.
          </p>
        </div>
        
        {/* Completion Metrics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-6 bg-gradient-to-br from-accent-50 to-accent-100/50 rounded-xl animate-fade-in">
            <div className="text-3xl font-bold text-accent-700">
              {completionScore}%
            </div>
            <div className="text-sm text-accent-700/80 mt-1 font-medium">
              Complete
            </div>
          </div>
          <div className="text-center p-6 bg-gradient-to-br from-neutral-50 to-neutral-100 rounded-xl animate-fade-in" style={{ animationDelay: '100ms' }}>
            <div className="text-3xl font-bold text-neutral-700">
              {wordCount}
            </div>
            <div className="text-sm text-neutral-600 mt-1 font-medium">
              Words
            </div>
            <div className="text-xs text-neutral-500 mt-0.5">
              Target: {targetWordCount.min}-{targetWordCount.max}
            </div>
          </div>
          <div className="text-center p-6 bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-xl animate-fade-in" style={{ animationDelay: '200ms' }}>
            <div className="text-3xl font-bold text-emerald-700">
              {completedFields}/{allFields.length}
            </div>
            <div className="text-sm text-emerald-700/80 mt-1 font-medium">
              Fields
            </div>
          </div>
        </div>
        
        {/* Content Sections */}
        <div className="space-y-6">
          {sections.map((section, sectionIndex) => {
            const sectionFields = section.fields.filter(field => 
              getValue(formData, field.key)
            );
            
            if (!sectionFields.length) return null;
            
            return (
              <div 
                key={section.id}
                className="bg-white rounded-xl shadow-lg shadow-neutral-200/30 ring-1 ring-neutral-900/5 p-8 space-y-4 animate-slide-from-bottom"
                style={{ animationDelay: `${sectionIndex * 100}ms` }}
              >
                {/* Section Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent-100">
                      {section.icon}
                    </div>
                    <h3 className="text-xl font-semibold text-neutral-900">
                      {section.title}
                    </h3>
                  </div>
                  <button
                    onClick={() => onEdit(section.id)}
                    className={cn(
                      "flex items-center space-x-2 px-4 py-2",
                      "text-sm font-medium rounded-lg",
                      "text-accent-700 bg-accent-50",
                      "hover:bg-accent-100 transition-colors duration-150",
                      "focus-visible:outline-none focus-visible:ring-2",
                      "focus-visible:ring-accent-500 focus-visible:ring-offset-2"
                    )}
                  >
                    <Edit2 className="w-4 h-4" />
                    <span>Edit</span>
                  </button>
                </div>
                
                {/* Fields */}
                <dl className="space-y-3">
                  {sectionFields.map(field => (
                    <div key={field.key} className="flex">
                      <dt className="w-32 text-sm font-medium text-neutral-600 flex-shrink-0">
                        {field.label}:
                      </dt>
                      <dd className="flex-1 text-base text-neutral-900">
                        {getValue(formData, field.key)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })}
          
          {/* Preview Card */}
          {generatedPrompt && (
            <div className="bg-gradient-to-br from-neutral-50 to-neutral-100 rounded-xl p-8 space-y-4 border-2 border-neutral-200 animate-fade-in" style={{ animationDelay: '300ms' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-5 h-5 text-neutral-700" />
                  <h3 className="text-lg font-semibold text-neutral-900">
                    Generated Prompt Preview
                  </h3>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleCopy}
                    className={cn(
                      "p-2 rounded-lg transition-colors duration-150",
                      "text-neutral-600 hover:text-accent-600 hover:bg-accent-50",
                      "focus-visible:outline-none focus-visible:ring-2",
                      "focus-visible:ring-accent-500 focus-visible:ring-offset-2"
                    )}
                    title="Copy to clipboard"
                  >
                    {copied ? (
                      <CheckCircle className="w-5 h-5 text-emerald-600 animate-scale-in-bounce" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    onClick={handleDownload}
                    className={cn(
                      "p-2 rounded-lg transition-colors duration-150",
                      "text-neutral-600 hover:text-accent-600 hover:bg-accent-50",
                      "focus-visible:outline-none focus-visible:ring-2",
                      "focus-visible:ring-accent-500 focus-visible:ring-offset-2"
                    )}
                    title="Download as text file"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <p className="text-base text-neutral-700 leading-relaxed">
                {generatedPrompt}
              </p>
            </div>
          )}
        </div>
        
        {/* Navigation - Sticky Bottom */}
        <div className="sticky bottom-0 -mx-8 -mb-12 p-8 bg-gradient-to-t from-neutral-50 via-neutral-50 to-transparent pt-20">
          <div className="flex items-center justify-between">
            <button
              onClick={onBack}
              className={cn(
                "inline-flex items-center space-x-2 px-6 py-3",
                "text-base font-medium rounded-lg",
                "text-neutral-700 bg-white border-2 border-neutral-200",
                "hover:bg-neutral-50 hover:border-neutral-300",
                "transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-2",
                "focus-visible:ring-accent-500 focus-visible:ring-offset-2"
              )}
            >
              <span>← Back</span>
            </button>
            
            <button
              onClick={onGenerate}
              className={cn(
                "inline-flex items-center justify-center space-x-2",
                "px-8 py-4 rounded-xl",
                "text-lg font-semibold text-white",
                "bg-gradient-to-r from-accent-600 to-accent-700",
                "shadow-lg shadow-accent-500/30",
                "hover:from-accent-700 hover:to-accent-800",
                "hover:shadow-xl hover:shadow-accent-500/40",
                "hover:scale-[1.02]",
                "active:scale-[0.98]",
                "transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2",
                "focus-visible:ring-accent-500 focus-visible:ring-offset-2"
              )}
            >
              <Sparkles className="w-5 h-5" />
              <span>Generate Your Optimized Prompt</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
          <p className="text-center text-sm text-neutral-600 mt-3">
            This will create a prompt optimized for all major AI video models
          </p>
        </div>
      </div>
    </div>
  );
};

SummaryReviewEnhanced.propTypes = {
  formData: PropTypes.object.isRequired,
  onEdit: PropTypes.func.isRequired,
  onGenerate: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired
};

export default SummaryReviewEnhanced;
