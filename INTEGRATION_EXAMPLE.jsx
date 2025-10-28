/**
 * Integration Example - Enhanced UI Components
 * 
 * This file demonstrates how to integrate the new enhanced components
 * into your existing wizard flow.
 */

import React, { useState } from 'react';
import WizardProgress from './client/src/components/wizard/WizardProgress';
import StepCreativeBriefEnhanced from './client/src/components/wizard/StepCreativeBriefEnhanced';
import SummaryReviewEnhanced from './client/src/components/wizard/SummaryReviewEnhanced';

/**
 * Example Wizard Component
 */
const EnhancedWizardExample = () => {
  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [formData, setFormData] = useState({
    subject: '',
    action: '',
    location: '',
    time: '',
    mood: '',
    style: '',
    event: ''
  });
  
  // Suggestions state
  const [suggestions, setSuggestions] = useState({});
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState({});
  const [validationErrors, setValidationErrors] = useState({});
  
  // Step configuration
  const steps = [
    { label: 'Creative Brief', description: 'Define your concept' },
    { label: 'Technical Details', description: 'Camera & lighting' },
    { label: 'Review', description: 'Final review' }
  ];
  
  // Handle form data changes
  const handleChange = (updates) => {
    setFormData(prev => ({ ...prev, ...updates }));
    
    // Clear validation errors for updated fields
    const updatedFields = Object.keys(updates);
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      updatedFields.forEach(field => delete newErrors[field]);
      return newErrors;
    });
  };
  
  // Request suggestions from AI service
  const handleRequestSuggestions = async (fieldName, value) => {
    // Set loading state
    setIsLoadingSuggestions(prev => ({ ...prev, [fieldName]: true }));
    
    try {
      // Call your AI service here
      // Example:
      // const response = await aiWizardService.getSuggestions(fieldName, value, formData);
      
      // Mock suggestions for demonstration
      const mockSuggestions = [
        { text: 'A professional athlete', compatibility: 85 },
        { text: 'A vintage sports car', compatibility: 78 },
        { text: 'A golden retriever', compatibility: 82 }
      ];
      
      setSuggestions(prev => ({
        ...prev,
        [fieldName]: mockSuggestions
      }));
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    } finally {
      setIsLoadingSuggestions(prev => ({ ...prev, [fieldName]: false }));
    }
  };
  
  // Validate step
  const validateStep = (stepIndex) => {
    const errors = {};
    
    if (stepIndex === 0) {
      // Validate creative brief
      if (!formData.subject || formData.subject.length < 3) {
        errors.subject = 'Please describe the main subject (at least 3 characters)';
      }
      if (!formData.action || formData.action.length < 3) {
        errors.action = 'Please describe the action (at least 3 characters)';
      }
      if (!formData.location || formData.location.length < 3) {
        errors.location = 'Please describe the location (at least 3 characters)';
      }
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  // Handle next step
  const handleNext = () => {
    if (!validateStep(currentStep)) {
      return;
    }
    
    // Mark current step as completed
    if (!completedSteps.includes(currentStep)) {
      setCompletedSteps(prev => [...prev, currentStep]);
    }
    
    // Move to next step
    setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
  };
  
  // Handle back
  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };
  
  // Handle step click (navigation)
  const handleStepClick = (stepIndex) => {
    if (completedSteps.includes(stepIndex) || stepIndex < currentStep) {
      setCurrentStep(stepIndex);
    }
  };
  
  // Handle edit from review
  const handleEdit = (sectionId) => {
    if (sectionId === 'creative') {
      setCurrentStep(0);
    } else if (sectionId === 'technical') {
      setCurrentStep(1);
    }
  };
  
  // Handle final generation
  const handleGenerate = () => {
    console.log('Generating prompt with data:', formData);
    // Call your generation service here
    // Example:
    // await aiWizardService.generateFinalPrompt(formData);
  };
  
  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Progress Header */}
      <WizardProgress
        currentStep={currentStep}
        totalSteps={steps.length}
        stepLabels={steps.map(s => s.label)}
        completedSteps={completedSteps}
        onStepClick={handleStepClick}
      />
      
      {/* Step Content */}
      <div className="pb-20">
        {currentStep === 0 && (
          <StepCreativeBriefEnhanced
            formData={formData}
            onChange={handleChange}
            onNext={handleNext}
            suggestions={suggestions}
            isLoadingSuggestions={isLoadingSuggestions}
            onRequestSuggestions={handleRequestSuggestions}
            validationErrors={validationErrors}
          />
        )}
        
        {currentStep === 1 && (
          <div className="max-w-5xl mx-auto px-8 py-12">
            <h2 className="text-3xl font-bold text-neutral-900 mb-6">
              Technical Details
            </h2>
            <p className="text-neutral-600 mb-8">
              This step would contain technical specifications (camera, lighting, etc.)
            </p>
            <div className="flex items-center justify-between">
              <button
                onClick={handleBack}
                className="px-6 py-3 text-base font-medium rounded-lg text-neutral-700 bg-white border-2 border-neutral-200 hover:bg-neutral-50"
              >
                Back
              </button>
              <button
                onClick={handleNext}
                className="px-8 py-3.5 text-base font-semibold rounded-xl text-white bg-gradient-to-br from-accent-600 to-accent-700 shadow-md hover:shadow-lg"
              >
                Continue
              </button>
            </div>
          </div>
        )}
        
        {currentStep === 2 && (
          <SummaryReviewEnhanced
            formData={formData}
            onEdit={handleEdit}
            onGenerate={handleGenerate}
            onBack={handleBack}
          />
        )}
      </div>
    </div>
  );
};

export default EnhancedWizardExample;

/**
 * INTEGRATION NOTES:
 * 
 * 1. Import the enhanced components instead of the original ones
 * 2. The onChange handler now receives an object of updates, not individual field/value
 * 3. onRequestSuggestions receives (fieldName, value) - implement your AI service call
 * 4. WizardProgress has been updated in place - no import change needed
 * 5. All components support the same data structure as before
 * 
 * REQUIRED CHANGES TO YOUR EXISTING CODE:
 * 
 * Before:
 * onChange('subject', 'A professional athlete')
 * 
 * After:
 * onChange({ subject: 'A professional athlete' })
 * 
 * This allows for cleaner batch updates and better React performance.
 */
