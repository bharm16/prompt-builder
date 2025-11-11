import React, { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useToast } from '../../../components/Toast';

// Components
import MobileFieldView from '../MobileFieldView';
import { StepQuickFill } from '../StepQuickFill';
import { CoreConceptAccordion } from '../StepCoreConcept';
import StepAtmosphere from '../StepAtmosphere';
import SummaryReview from '../SummaryReview';
import WizardEntryPage from '../WizardEntryPage';
import SavedDraftBanner from '../SavedDraftBanner';

// Services
import { aiWizardService } from '../../../services/aiWizardService';

// Hooks
import { useWizardState } from './hooks/useWizardState';
import { useWizardPersistence } from './hooks/useWizardPersistence';
import { useWizardValidation } from './hooks/useWizardValidation';
import { useResponsive } from './hooks/useResponsive';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

// Config
import { STEP_LABELS } from './config/stepConfig';
import { MOBILE_FIELDS } from './config/fieldConfig';
import { INITIAL_FORM_DATA, STORAGE_KEY } from './config/constants';

// Utils
import {
  formatElements,
  formatMetadata,
} from './utils/promptGenerator';
import {
  validateMobileField,
  canNavigateNext,
} from './utils/navigationHelpers';

/**
 * WizardVideoBuilder - Main Orchestrator Component
 *
 * Responsibilities:
 * - Detect screen size and route to appropriate UI (mobile vs desktop)
 * - Manage global wizard state via useReducer
 * - Auto-save to localStorage every 2 seconds
 * - Restore from saved state on mount
 * - Handle keyboard shortcuts (Enter, Esc)
 * - Track completion progress
 * - Handle final submission
 *
 * Breakpoints:
 * - Mobile: < 768px (single field view)
 * - Tablet: 768-1023px (simplified step view)
 * - Desktop: >= 1024px (full step view)
 */
export const WizardVideoBuilder = ({
  onConceptComplete,
  initialConcept = '',
  onSave = null,
}) => {
  // Responsive detection
  const { isMobile, isTablet, isDesktop } = useResponsive();

  // Toast notifications and loading state
  const toast = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Saved draft state
  const [savedDraft, setSavedDraft] = useState(null);

  // Parse initial concept if provided
  const initialFormData = initialConcept && typeof initialConcept === 'string' && initialConcept.trim()
    ? { ...INITIAL_FORM_DATA, subject: initialConcept }
    : INITIAL_FORM_DATA;

  // Centralized state management
  const { state, actions } = useWizardState(initialFormData);
  const {
    showEntryPage,
    currentStep,
    currentMobileFieldIndex,
    formData,
    suggestions,
    isLoadingSuggestions,
    validationErrors,
    completedSteps,
  } = state;

  // Validation
  const { validateStep, isStepComplete, validateRequiredFields } = useWizardValidation(
    formData,
    actions.setValidationErrors,
    actions.addCompletedStep
  );

  // Persistence (auto-save and restore)
  const { clearLocalStorage } = useWizardPersistence({
    formData,
    currentStep,
    currentMobileFieldIndex,
    onSave,
    onDraftFound: (restored) => {
      // Store the draft and show banner instead of immediately restoring
      setSavedDraft(restored);
    },
  });

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handle continuing with saved draft
   */
  const handleContinueDraft = useCallback(() => {
    if (savedDraft) {
      actions.setFormData(savedDraft.formData);
      actions.setCurrentStep(savedDraft.currentStep || 0);
      actions.setMobileFieldIndex(savedDraft.currentMobileFieldIndex || 0);
      actions.setShowEntryPage(false);
      setSavedDraft(null);
      toast.success('Your saved draft has been restored');
    }
  }, [savedDraft, actions, toast]);

  /**
   * Handle starting fresh (discarding saved draft)
   */
  const handleStartFresh = useCallback(() => {
    clearLocalStorage();
    setSavedDraft(null);
    toast.info('Starting with a fresh draft');
  }, [clearLocalStorage, toast]);

  /**
   * Handle field change
   */
  const handleFieldChange = useCallback((fieldName, value) => {
    actions.setFieldValue(fieldName, value);
  }, [actions]);

  /**
   * Request AI suggestions
   */
  const handleRequestSuggestions = useCallback(async (fieldName, currentValue) => {
    actions.setLoadingSuggestions(fieldName, true);

    try {
      const context = {
        subject: formData.subject,
        action: formData.action,
        location: formData.location,
        time: formData.time,
        mood: formData.mood,
        style: formData.style,
      };

      const fetchedSuggestions = await aiWizardService.getSuggestions(
        fieldName,
        currentValue,
        context
      );

      actions.setSuggestions(fieldName, fetchedSuggestions);
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
      actions.setSuggestions(fieldName, []);
    } finally {
      actions.setLoadingSuggestions(fieldName, false);
    }
  }, [formData, actions]);

  /**
   * Navigate to next step
   */
  const handleNextStep = useCallback(() => {
    if (validateStep(currentStep)) {
      actions.addCompletedStep(currentStep);
      actions.setCurrentStep(Math.min(currentStep + 1, STEP_LABELS.length - 1));
    }
  }, [currentStep, validateStep, actions]);

  /**
   * Handle QuickFill "Continue to Summary"
   */
  const handleQuickFillContinue = useCallback(() => {
    if (validateStep(0)) {
      actions.addCompletedStep(0);
      actions.setCurrentStep(3); // Jump to Summary
    }
  }, [validateStep, actions]);

  /**
   * Handle switch from QuickFill to step-by-step
   */
  const handleSwitchToStepByStep = useCallback(() => {
    actions.addCompletedStep(0);
    actions.setCurrentStep(1); // Go to Core Concept
  }, [actions]);

  /**
   * Navigate to previous step
   */
  const handlePreviousStep = useCallback(() => {
    actions.setCurrentStep(Math.max(currentStep - 1, 0));
  }, [currentStep, actions]);

  /**
   * Navigate to specific step (desktop only)
   */
  const handleGoToStep = useCallback((step) => {
    // Allow navigation to previous completed steps, or to step 0 (QuickFill)
    if (step <= currentStep || completedSteps.includes(step) || step === 0) {
      actions.setCurrentStep(step);
    }
  }, [currentStep, completedSteps, actions]);

  /**
   * Handle entry page "Get Started"
   */
  const handleGetStarted = useCallback(() => {
    actions.setShowEntryPage(false);
  }, [actions]);

  /**
   * Mobile field navigation - Next
   */
  const handleMobileNextField = useCallback(() => {
    const currentField = MOBILE_FIELDS[currentMobileFieldIndex];
    const currentValue = formData[currentField.name];

    // Validate required fields
    if (currentField.required && (!currentValue || currentValue.trim().length === 0)) {
      actions.setValidationError(currentField.name, `${currentField.label} is required`);
      return;
    }

    // Move to next field or complete
    if (currentMobileFieldIndex < MOBILE_FIELDS.length - 1) {
      actions.setMobileFieldIndex(currentMobileFieldIndex + 1);
      actions.setValidationErrors({});
    } else {
      handleMobileComplete();
    }
  }, [currentMobileFieldIndex, formData, actions]);

  /**
   * Mobile field navigation - Previous
   */
  const handleMobilePreviousField = useCallback(() => {
    actions.setMobileFieldIndex(Math.max(currentMobileFieldIndex - 1, 0));
    actions.setValidationErrors({});
  }, [currentMobileFieldIndex, actions]);

  /**
   * Handle mobile complete
   */
  const handleMobileComplete = useCallback(() => {
    // Navigate to summary (step 3)
    actions.setCurrentStep(3);
  }, [actions]);

  /**
   * Edit from summary
   */
  const handleEdit = useCallback((step) => {
    // Map old step references to new structure
    // step 0 -> step 1 (Core Concept), step 1 -> step 2 (Atmosphere)
    const stepMap = { 0: 1, 1: 2 };
    actions.setCurrentStep(stepMap[step] !== undefined ? stepMap[step] : step);
  }, [actions]);

  /**
   * Complete wizard
   */
  const handleComplete = useCallback(async () => {
    // Validate required fields
    if (!validateRequiredFields()) {
      alert('Please fill in all required fields (Subject and Action)');
      actions.setCurrentStep(0); // Go to QuickFill if validation fails
      return;
    }

    // Generate final prompt
    const finalPrompt = aiWizardService.generatePrompt(formData);

    // Format elements and metadata
    const elements = formatElements(formData);
    const metadata = {
      ...formatMetadata(formData),
      validationScore: aiWizardService.getCompletionPercentage(formData),
      history: [],
      subjectDescriptors: [],
    };

    // Clear saved draft
    clearLocalStorage();

    // Call onConceptComplete callback
    if (onConceptComplete) {
      onConceptComplete(finalPrompt, elements, metadata);
    }
  }, [formData, validateRequiredFields, clearLocalStorage, onConceptComplete, actions]);

  /**
   * Generate wizard prompt and close modal
   * This calls onConceptComplete which closes the wizard modal
   * and automatically optimizes the prompt
   */
  const handleGenerate = useCallback(async () => {
    try {
      setIsGenerating(true);
      
      // Validate required fields
      if (!validateRequiredFields()) {
        toast.error('Please fill in all required fields before generating');
        setIsGenerating(false);
        return;
      }
      
      // Generate final prompt
      const finalPrompt = aiWizardService.generatePrompt(formData);
      
      // Validate prompt isn't empty
      if (!finalPrompt || finalPrompt.trim().length === 0) {
        toast.error('Unable to generate prompt. Please check your inputs.');
        setIsGenerating(false);
        return;
      }
      
      // Format elements and metadata for the concept complete callback
      const elements = formatElements(formData);
      const metadata = {
        ...formatMetadata(formData),
        validationScore: aiWizardService.getCompletionPercentage(formData),
        history: [],
        subjectDescriptors: [],
      };
      
      // Call onConceptComplete callback
      // This will close the wizard modal and automatically optimize the prompt
      if (onConceptComplete) {
        onConceptComplete(finalPrompt, elements, metadata);
      }
      
      // Clear saved draft
      clearLocalStorage();
      
    } catch (error) {
      console.error('Failed to generate prompt:', error);
      toast.error('Failed to generate prompt. Please try again.');
      setIsGenerating(false);
    }
  }, [formData, validateRequiredFields, clearLocalStorage, onConceptComplete, toast]);

  // ============================================================================
  // Keyboard Shortcuts (Desktop only)
  // ============================================================================

  const currentStepRef = useRef(currentStep);
  const handlePreviousStepRef = useRef(handlePreviousStep);

  useEffect(() => {
    currentStepRef.current = currentStep;
    handlePreviousStepRef.current = handlePreviousStep;
  }, [currentStep, handlePreviousStep]);

  useKeyboardShortcuts({
    onNext: null, // Not used globally
    onPrevious: () => {
      if (currentStepRef.current > 0) {
        handlePreviousStepRef.current();
      }
    },
    enabled: !isMobile,
  });

  // ============================================================================
  // Render Logic
  // ============================================================================

  // Mobile field validation
  const isCurrentMobileFieldValid = validateMobileField(currentMobileFieldIndex, formData);
  const canGoNext = canNavigateNext(currentMobileFieldIndex, formData);

  // Render entry page
  if (showEntryPage) {
    return <WizardEntryPage onGetStarted={handleGetStarted} />;
  }

  // Render mobile view
  if (isMobile && currentStep < 2) {
    const currentField = MOBILE_FIELDS[currentMobileFieldIndex];
    const currentValue = formData[currentField.name] || '';

    return (
      <div className="h-screen flex flex-col overflow-hidden">
        {/* Saved Draft Banner */}
        {savedDraft && (
          <SavedDraftBanner
            onContinue={handleContinueDraft}
            onStartFresh={handleStartFresh}
          />
        )}

        {/* Mobile Field View */}
        <div className="flex-1 overflow-hidden">
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
            totalFields={MOBILE_FIELDS.length}
            isLastField={currentMobileFieldIndex === MOBILE_FIELDS.length - 1}
            canGoBack={currentMobileFieldIndex > 0}
            canGoNext={canGoNext}
            validationError={validationErrors[currentField.name]}
            isValid={isCurrentMobileFieldValid}
          />
        </div>
      </div>
    );
  }

  // Render desktop view
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      {/* Saved Draft Banner */}
      {savedDraft && (
        <SavedDraftBanner
          onContinue={handleContinueDraft}
          onStartFresh={handleStartFresh}
        />
      )}

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
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
            onBack={handlePreviousStep}
          />
        )}
      </div>
    </div>
  );
};

WizardVideoBuilder.propTypes = {
  onConceptComplete: PropTypes.func.isRequired,
  initialConcept: PropTypes.string,
  onSave: PropTypes.func,
};

WizardVideoBuilder.defaultProps = {
  initialConcept: '',
  onSave: null,
};

export default WizardVideoBuilder;

