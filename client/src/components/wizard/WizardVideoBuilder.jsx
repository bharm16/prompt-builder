import React, { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import WizardProgress from './WizardProgress';
import MobileFieldView from './MobileFieldView';
import { StepQuickFill } from './StepQuickFill';
import { CoreConceptAccordion } from './StepCoreConcept';
import StepAtmosphere from './StepAtmosphere';
import SummaryReview from './SummaryReview';
import WizardEntryPage from './WizardEntryPage';
import { aiWizardService } from '../../services/aiWizardService';

/**
 * WizardVideoBuilder - Main Orchestrator Component
 *
 * Responsibilities:
 * - Detect screen size and route to appropriate UI (mobile vs desktop)
 * - Manage global wizard state (currentStep, formData, validation)
 * - Auto-save to localStorage every 2 seconds
 * - Restore from saved state on mount
 * - Handle keyboard shortcuts (Enter, Esc, Tab)
 * - Track completion progress
 * - Handle final submission
 *
 * Breakpoints:
 * - Mobile: < 768px (single field view)
 * - Tablet: 768-1023px (simplified step view)
 * - Desktop: >= 1024px (full step view)
 */
const WizardVideoBuilder = ({
  onConceptComplete,
  initialConcept = '',
  onSave = null
}) => {
  // Responsive detection
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isTablet, setIsTablet] = useState(window.innerWidth >= 768 && window.innerWidth < 1024);

  // Entry page state
  const [showEntryPage, setShowEntryPage] = useState(true);

  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);
  const [currentMobileFieldIndex, setCurrentMobileFieldIndex] = useState(0);
  const [formData, setFormData] = useState({
    // Step 1: Core Concept (required)
    subject: '',
    descriptor1: '',
    descriptor2: '',
    descriptor3: '',
    action: '',
    location: '',
    // Step 2: Atmosphere (optional)
    time: '',
    mood: '',
    style: '',
    event: '',
    // Step 3: Technical (optional)
    camera: {},
    lighting: {},
    composition: {},
    motion: {},
    effects: {}
  });

  // Suggestions state
  const [suggestions, setSuggestions] = useState({});
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState({});

  // Validation state
  const [validationErrors, setValidationErrors] = useState({});
  const [completedSteps, setCompletedSteps] = useState([]);

  // Auto-save timer
  const autoSaveTimer = useRef(null);
  const lastSavedData = useRef(null);
  const onSaveRef = useRef(onSave);

  // Constants
  const STORAGE_KEY = 'wizard_video_builder_draft';
  const AUTO_SAVE_DELAY = 2000; // 2 seconds
  
  // Keep onSave ref up to date
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  // Mobile field configuration
  const mobileFields = [
    { name: 'subject', label: 'What\'s the main focus of your video?', description: 'This could be a person, object, animal, or anything else', placeholder: 'e.g., A professional athlete', required: true },
    { name: 'action', label: 'What\'s the subject doing?', description: 'Describe the movement, activity, or transformation', placeholder: 'e.g., running through', required: true },
    { name: 'location', label: 'Where is all this happening?', description: 'Describe the setting or environment', placeholder: 'e.g., a sun-drenched beach', required: true },
    { name: 'time', label: 'When does this happen?', description: 'Time of day, era, or season (optional but recommended)', placeholder: 'e.g., during golden hour', required: false },
    { name: 'mood', label: 'What\'s the emotional atmosphere?', description: 'The feeling you want to evoke (optional but recommended)', placeholder: 'e.g., energetic and joyful', required: false },
    { name: 'style', label: 'What visual style are you going for?', description: 'The aesthetic treatment (optional but recommended)', placeholder: 'e.g., cinematic', required: false },
    { name: 'event', label: 'Any specific context or occasion?', description: 'The broader story or event (optional)', placeholder: 'e.g., a celebration', required: false }
  ];

  // Desktop step labels (with QuickFill as step 0)
  const stepLabels = ['Quick Fill', 'Core Concept', 'Atmosphere', 'Review'];

  // Window resize handler
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      setIsTablet(width >= 768 && width < 1024);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Restore from localStorage on mount
  useEffect(() => {
    const restored = restoreFromLocalStorage();
    if (restored) {
      // Prompt user to continue
      const shouldContinue = window.confirm(
        'We found a saved draft from your previous session. Would you like to continue where you left off?'
      );
      if (shouldContinue) {
        setFormData(restored.formData);
        setCurrentStep(restored.currentStep || 0);
        setCurrentMobileFieldIndex(restored.currentMobileFieldIndex || 0);
        setShowEntryPage(false); // Skip entry page when restoring
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } else if (initialConcept) {
      // Parse initial concept if provided (basic parsing)
      // For now, just set it as the subject if it's a simple string
      if (typeof initialConcept === 'string' && initialConcept.trim()) {
        setFormData({ ...formData, subject: initialConcept });
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save effect with optimized change detection
  useEffect(() => {
    // Clear existing timer
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }

    // Schedule auto-save (debounced)
    autoSaveTimer.current = setTimeout(() => {
      // Only save if data has actually changed (simple reference check)
      // lastSavedData will be updated in saveToLocalStorage
      if (formData !== lastSavedData.current) {
        saveToLocalStorage();
        if (onSaveRef.current) {
          onSaveRef.current(formData);
        }
        lastSavedData.current = formData;
      }
    }, AUTO_SAVE_DELAY);

    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, [formData]); // Only depend on formData, not onSave

  // Save to localStorage
  const saveToLocalStorage = () => {
    try {
      const saveData = {
        formData,
        currentStep,
        currentMobileFieldIndex,
        timestamp: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
      lastSavedData.current = formData;
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  };

  // Restore from localStorage
  const restoreFromLocalStorage = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return null;

      const data = JSON.parse(saved);
      const age = Date.now() - data.timestamp;
      const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

      if (age > MAX_AGE) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Failed to restore from localStorage:', error);
      return null;
    }
  };

  // Update form data
  // Use stable callback without validationErrors dependency to avoid re-renders
  const handleFieldChange = useCallback((fieldName, value) => {
    setFormData(prev => {
      // Handle nested fields (e.g., "camera.angle")
      if (fieldName.includes('.')) {
        const [category, field] = fieldName.split('.');
        return {
          ...prev,
          [category]: {
            ...prev[category],
            [field]: value
          }
        };
      }
      return {
        ...prev,
        [fieldName]: value
      };
    });

    // Clear validation error for this field (using functional update)
    setValidationErrors(prev => {
      if (prev[fieldName]) {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      }
      return prev; // No change if no error existed
    });
  }, []); // Stable callback with no dependencies

  // Request AI suggestions
  const handleRequestSuggestions = useCallback(async (fieldName, currentValue) => {
    setIsLoadingSuggestions(prev => ({ ...prev, [fieldName]: true }));

    try {
      const context = {
        subject: formData.subject,
        action: formData.action,
        location: formData.location,
        time: formData.time,
        mood: formData.mood,
        style: formData.style
      };

      const fetchedSuggestions = await aiWizardService.getSuggestions(
        fieldName,
        currentValue,
        context
      );

      setSuggestions(prev => ({
        ...prev,
        [fieldName]: fetchedSuggestions
      }));
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
      setSuggestions(prev => ({ ...prev, [fieldName]: [] }));
    } finally {
      setIsLoadingSuggestions(prev => ({ ...prev, [fieldName]: false }));
    }
  }, [formData]);

  // Validate step
  const validateStep = (step) => {
    const errors = {};

    if (step === 0) {
      // QuickFill step - validate Subject and Action (no min length)
      if (!formData.subject || formData.subject.trim().length === 0) {
        errors.subject = 'Subject is required';
      }
      if (!formData.action || formData.action.trim().length === 0) {
        errors.action = 'Action is required';
      }
      // Note: descriptors are optional, so no validation needed
    } else if (step === 1) {
      // Core Concept step - validate Subject and Action (no min length)
      if (!formData.subject || formData.subject.trim().length === 0) {
        errors.subject = 'Subject is required';
      }
      if (!formData.action || formData.action.trim().length === 0) {
        errors.action = 'Action is required';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Navigate to next step
  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      if (!completedSteps.includes(currentStep)) {
        setCompletedSteps(prev => [...prev, currentStep]);
      }
      setCurrentStep(prev => Math.min(prev + 1, stepLabels.length - 1));
    }
  };

  // Handle QuickFill "Continue to Summary"
  const handleQuickFillContinue = () => {
    if (validateStep(0)) {
      if (!completedSteps.includes(0)) {
        setCompletedSteps(prev => [...prev, 0]);
      }
      // Jump directly to Summary (step 3)
      setCurrentStep(3);
    }
  };

  // Handle switch from QuickFill to step-by-step
  const handleSwitchToStepByStep = () => {
    // Mark QuickFill as completed but skip to Core Concept (step 1)
    if (!completedSteps.includes(0)) {
      setCompletedSteps(prev => [...prev, 0]);
    }
    setCurrentStep(1);
  };

  // Navigate to previous step
  const handlePreviousStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  // Navigate to specific step (desktop only)
  const handleGoToStep = (step) => {
    // Allow navigation to previous completed steps, or to step 0 (QuickFill)
    if (step <= currentStep || completedSteps.includes(step) || step === 0) {
      setCurrentStep(step);
    }
  };

  // Handle entry page "Get Started"
  const handleGetStarted = () => {
    setShowEntryPage(false);
  };

  // Mobile field navigation
  const handleMobileNextField = () => {
    const currentField = mobileFields[currentMobileFieldIndex];
    const currentValue = formData[currentField.name];

    // Validate required fields (no minimum length)
    if (currentField.required && (!currentValue || currentValue.trim().length === 0)) {
      setValidationErrors({
        [currentField.name]: `${currentField.label} is required`
      });
      return;
    }

    // Move to next field or complete
    if (currentMobileFieldIndex < mobileFields.length - 1) {
      setCurrentMobileFieldIndex(prev => prev + 1);
      setValidationErrors({});
    } else {
      handleMobileComplete();
    }
  };

  const handleMobilePreviousField = () => {
    setCurrentMobileFieldIndex(prev => Math.max(prev - 1, 0));
    setValidationErrors({});
  };

  const handleMobileComplete = () => {
    // Navigate to summary (now step 3)
    setIsMobile(false); // Force desktop view for summary
    setCurrentStep(3);
  };

  // Edit from summary
  const handleEdit = (step) => {
    // Map old step references to new structure
    // step 0 -> step 1 (Core Concept), step 1 -> step 2 (Atmosphere)
    const stepMap = { 0: 1, 1: 2 };
    setCurrentStep(stepMap[step] !== undefined ? stepMap[step] : step);
  };

  // Complete wizard
  const handleComplete = async () => {
    // Validate required fields (Subject and Action) - no minimum length
    if (!formData.subject || formData.subject.trim().length === 0 || 
        !formData.action || formData.action.trim().length === 0) {
      alert('Please fill in all required fields (Subject and Action)');
      setCurrentStep(0); // Go to QuickFill if validation fails
      return;
    }

    // Generate final prompt
    const finalPrompt = aiWizardService.generatePrompt(formData);

    // Format elements to match expected structure
    const elements = {
      subject: formData.subject,
      action: formData.action,
      location: formData.location,
      time: formData.time,
      mood: formData.mood,
      style: formData.style,
      event: formData.event,
      // Note: Old system had subject descriptors, wizard doesn't yet
      subjectDescriptor1: '',
      subjectDescriptor2: '',
      subjectDescriptor3: ''
    };

    // Format metadata
    const metadata = {
      format: 'wizard',
      technicalParams: {
        camera: formData.camera || {},
        lighting: formData.lighting || {},
        composition: formData.composition || {},
        motion: formData.motion || {},
        effects: formData.effects || {}
      },
      validationScore: aiWizardService.getCompletionPercentage(formData),
      history: [],
      subjectDescriptors: []
    };

    // Clear saved draft
    localStorage.removeItem(STORAGE_KEY);

    // Call onConceptComplete callback with correct signature
    if (onConceptComplete) {
      onConceptComplete(finalPrompt, elements, metadata);
    }
  };

  // Keyboard shortcuts (desktop only)
  // Use refs to avoid re-attaching listener on every state change
  const currentStepRef = useRef(currentStep);
  const handlePreviousStepRef = useRef(handlePreviousStep);

  useEffect(() => {
    currentStepRef.current = currentStep;
    handlePreviousStepRef.current = handlePreviousStep;
  }, [currentStep, handlePreviousStep]);

  useEffect(() => {
    if (isMobile) return;

    const handleKeyDown = (e) => {
      // Ignore if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        if (currentStepRef.current > 0) {
          handlePreviousStepRef.current();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobile]); // Stable dependencies - no re-attachment  

  // Validate current field (mobile)
  const validateCurrentMobileField = () => {
    const currentField = mobileFields[currentMobileFieldIndex];
    const currentValue = formData[currentField.name];

    if (currentField.required) {
      return currentValue && currentValue.trim().length > 0;
    }
    return true; // Optional fields are always valid
  };

  const isCurrentMobileFieldValid = validateCurrentMobileField();
  const canGoNext = !mobileFields[currentMobileFieldIndex].required || isCurrentMobileFieldValid;

  // Render entry page
  if (showEntryPage) {
    return <WizardEntryPage onGetStarted={handleGetStarted} />;
  }

  // Render mobile view
  if (isMobile && currentStep < 2) {
    const currentField = mobileFields[currentMobileFieldIndex];
    const currentValue = formData[currentField.name] || '';

    return (
      <MobileFieldView
        field={currentField}
        value={currentValue}
        onChange={(value) => handleFieldChange(currentField.name, value)}
        onNext={handleMobileNextField}
        onPrevious={handleMobilePreviousField}
        onComplete={handleMobileComplete}
        suggestions={suggestions[currentField.name] || []}
        isLoadingSuggestions={isLoadingSuggestions[currentField.name] || false}
        onRequestSuggestions={handleRequestSuggestions}
        currentFieldIndex={currentMobileFieldIndex}
        totalFields={mobileFields.length}
        isLastField={currentMobileFieldIndex === mobileFields.length - 1}
        canGoBack={currentMobileFieldIndex > 0}
        canGoNext={canGoNext}
        validationError={validationErrors[currentField.name]}
        isValid={isCurrentMobileFieldValid}
      />
    );
  }

  // Render desktop view
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      {/* Progress Indicator - Minimal mode (gradient line only) */}
      <WizardProgress
        currentStep={currentStep}
        totalSteps={stepLabels.length}
        stepLabels={stepLabels}
        completedSteps={completedSteps}
        isMobile={isMobile}
        onStepClick={handleGoToStep}
        minimal={true}
      />

      {/* Step Content */}
      <div className="flex-1 overflow-y-auto pb-8">
        {currentStep === 0 && (
          <StepQuickFill
            formData={formData}
            onChange={handleFieldChange}
            onContinue={handleQuickFillContinue}
            onSwitchToStepByStep={handleSwitchToStepByStep}
            suggestions={suggestions}
            isLoadingSuggestions={isLoadingSuggestions}
            onRequestSuggestions={handleRequestSuggestions}
          />
        )}

        {currentStep === 1 && (
          <CoreConceptAccordion
            formData={formData}
            onChange={handleFieldChange}
            onNext={handleNextStep}
            suggestions={suggestions}
            isLoadingSuggestions={isLoadingSuggestions}
            onRequestSuggestions={handleRequestSuggestions}
          />
        )}

        {currentStep === 2 && (
          <StepAtmosphere
            formData={formData}
            onChange={handleFieldChange}
            onNext={handleNextStep}
            onBack={handlePreviousStep}
            suggestions={suggestions}
            isLoadingSuggestions={isLoadingSuggestions}
            onRequestSuggestions={handleRequestSuggestions}
          />
        )}

        {currentStep === 3 && (
          <SummaryReview
            formData={formData}
            onEdit={handleEdit}
            onGenerate={handleComplete}
            onBack={handlePreviousStep}
            isMobile={isMobile}
          />
        )}
      </div>
    </div>
  );
};

WizardVideoBuilder.propTypes = {
  onConceptComplete: PropTypes.func.isRequired,
  initialConcept: PropTypes.string,
  onSave: PropTypes.func
};

export default WizardVideoBuilder;
