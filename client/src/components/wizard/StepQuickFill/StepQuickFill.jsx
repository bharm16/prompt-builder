/**
 * StepQuickFill - Quick Fill mode orchestrator
 *
 * Bento box grid layout for faster video prompt creation:
 * - Asymmetric grid with large required fields, small optional fields
 * - Tap to expand inline for editing
 * - AI suggestions appear inside expanded boxes
 * - Staggered entrance animations
 * - Progress tracking
 * - Mode toggle (Quick Fill ↔ Step-by-Step)
 *
 * @module StepQuickFill
 */

import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { ChevronRight } from 'lucide-react';
import { wizardTheme } from '../../../styles/wizardTheme';

// Reuse from StepCoreConcept
import { useResponsiveLayout } from '../StepCoreConcept/hooks/useResponsiveLayout';

// Config
import { FIELD_CONFIG } from './config/fieldConfig';
import { BENTO_FIELD_CONFIG, getBentoFieldOrder } from './config/bentoLayout';
import { injectAnimations } from './config/animations';

// Hooks
import { useStaggeredAnimation } from './hooks/useStaggeredAnimation';
import { useQuickFillForm } from './hooks/useQuickFillForm';
import { useBentoExpansion } from './hooks/useBentoExpansion';

// Components
import { ProgressBadge } from './components/ProgressBadge';
import { ModeToggle } from './components/ModeToggle';
import { BentoGrid } from './components/BentoGrid';
import BentoField from './components/BentoField';

/**
 * StepQuickFill component
 */
export function StepQuickFill({
  formData,
  onChange,
  onContinue,
  onSwitchToStepByStep,
  suggestions = {},
  isLoadingSuggestions = {},
  onRequestSuggestions,
}) {
  // Inject global animations on mount
  useEffect(() => {
    injectAnimations();
  }, []);

  // Use custom hooks
  const { mounted } = useStaggeredAnimation();
  const { validation, progress, activeField, suggestionsRef, handlers } = useQuickFillForm(
    formData,
    onChange,
    onRequestSuggestions
  );
  const { isDesktop, containerPadding, cardPadding } = useResponsiveLayout();
  const {
    expandedField,
    handleExpand,
    handleCollapse,
    isExpanded,
    registerInputRef,
  } = useBentoExpansion();

  const { canContinue } = validation;
  const { filledFields, totalFields, completionPercentage } = progress;
  const { handleFieldChange, handleSuggestionSelect, handleFocus, handleBlur } = handlers;

  // Get field order from bento config
  const fieldOrder = getBentoFieldOrder();
  
  // Merge field config with bento config
  const fieldsWithBentoConfig = fieldOrder.map(fieldId => {
    const field = FIELD_CONFIG.find(f => f.id === fieldId);
    const bentoConfig = BENTO_FIELD_CONFIG[fieldId];
    return { ...field, bentoConfig };
  });

  return (
    <main
      style={{
        flex: '1',
        width: '100%',
        maxWidth: '1920px',
        margin: '0 auto',
        padding: containerPadding,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 4px)',
        background: 'linear-gradient(135deg, #FAFAFA 0%, #F5F5F5 100%)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '32px',
          maxWidth: '1200px',
          width: '100%',
        }}
      >
        {/* Heading Section */}
        <section style={{ textAlign: 'center', width: '100%' }}>
          <h1
            style={{
              margin: 0,
              marginBottom: '12px',
              fontFamily: wizardTheme.fontFamily.primary,
              fontSize: isDesktop ? '48px' : '36px',
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              background:
                'linear-gradient(135deg, #2D2D2D 0%, #5A5A5A 50%, #2D2D2D 100%)',
              backgroundSize: '200% auto',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              animation: mounted ? 'none' : 'shimmer 3s linear infinite',
            }}
          >
            Quick Fill Mode
          </h1>
          <p
            style={{
              margin: 0,
              marginBottom: '16px',
              fontFamily: wizardTheme.fontFamily.primary,
              fontSize: '17px',
              fontWeight: 400,
              lineHeight: 1.5,
              color: wizardTheme.colors.neutral[600],
            }}
          >
            Complete all fields at once for faster creation
          </p>

          {/* Progress Indicator */}
          <ProgressBadge
            filledFields={filledFields}
            totalFields={totalFields}
            completionPercentage={completionPercentage}
          />
        </section>

        {/* Form Card */}
        <section style={{ width: '100%' }}>
          <div
            style={{
              backgroundColor: wizardTheme.colors.background.card,
              borderRadius: '20px',
              border: `1px solid ${wizardTheme.colors.neutral[200]}`,
              boxShadow:
                '0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.02)',
              padding: cardPadding,
              width: '100%',
              position: 'relative',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            {/* Mode Toggle */}
            <div
              style={{
                position: 'absolute',
                top: cardPadding,
                right: cardPadding,
                zIndex: 10,
              }}
            >
              <ModeToggle onSwitchToStepByStep={onSwitchToStepByStep} />
            </div>

            {/* Bento Grid Layout */}
            <div style={{ paddingTop: '64px' }}>
              <BentoGrid mounted={mounted}>
                {fieldsWithBentoConfig.map((field) => (
                  <BentoField
                    key={field.id}
                    field={field}
                    config={field.bentoConfig}
                    value={formData[field.id]}
                    isExpanded={isExpanded(field.id)}
                    onExpand={handleExpand}
                    onCollapse={handleCollapse}
                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                    onFocus={() => handleFocus(field.id)}
                    suggestions={suggestions?.[field.id]}
                    isLoadingSuggestions={Boolean(isLoadingSuggestions?.[field.id])}
                    onRequestSuggestions={onRequestSuggestions}
                    onSuggestionSelect={handleSuggestionSelect}
                    registerInputRef={registerInputRef}
                    mounted={mounted}
                  />
                ))}
              </BentoGrid>
            </div>

            {/* CTA Button */}
            <div
              style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '40px' }}
            >
              <button
                onClick={onContinue}
                disabled={!canContinue}
                style={{
                  position: 'relative',
                  padding: '16px 40px',
                  fontFamily: wizardTheme.fontFamily.primary,
                  fontSize: '16px',
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  color: '#FFFFFF',
                  background: canContinue
                    ? `linear-gradient(135deg, ${wizardTheme.colors.accent.base} 0%, ${wizardTheme.colors.accent.hover} 100%)`
                    : wizardTheme.colors.neutral[200],
                  borderRadius: '14px',
                  border: 'none',
                  cursor: canContinue ? 'pointer' : 'not-allowed',
                  boxShadow: canContinue
                    ? '0 8px 20px rgba(255, 56, 92, 0.3), 0 2px 8px rgba(0, 0, 0, 0.06)'
                    : 'none',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => {
                  if (canContinue) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow =
                      '0 12px 28px rgba(255, 56, 92, 0.4), 0 4px 12px rgba(0, 0, 0, 0.08)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (canContinue) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow =
                      '0 8px 20px rgba(255, 56, 92, 0.3), 0 2px 8px rgba(0, 0, 0, 0.06)';
                  }
                }}
              >
                Continue to Summary
                <ChevronRight size={20} strokeWidth={2.5} />
              </button>
            </div>

            {/* Keyboard Shortcut Hint */}
            {canContinue && (
              <div
                style={{
                  marginTop: '16px',
                  textAlign: 'right',
                  fontFamily: wizardTheme.fontFamily.primary,
                  fontSize: '12px',
                  color: wizardTheme.colors.neutral[400],
                  animation: 'slideDown 0.3s ease-out',
                }}
              >
                Press{' '}
                <kbd
                  style={{
                    padding: '2px 6px',
                    background: wizardTheme.colors.neutral[100],
                    border: `1px solid ${wizardTheme.colors.neutral[200]}`,
                    borderRadius: '4px',
                    fontFamily: wizardTheme.fontFamily.mono,
                    fontSize: '11px',
                  }}
                >
                  Enter
                </kbd>{' '}
                to continue
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

StepQuickFill.propTypes = {
  formData: PropTypes.shape({
    subject: PropTypes.string,
    descriptor1: PropTypes.string,
    descriptor2: PropTypes.string,
    descriptor3: PropTypes.string,
    action: PropTypes.string,
    location: PropTypes.string,
    time: PropTypes.string,
    mood: PropTypes.string,
    style: PropTypes.string,
    event: PropTypes.string,
  }).isRequired,
  onChange: PropTypes.func.isRequired,
  onContinue: PropTypes.func.isRequired,
  onSwitchToStepByStep: PropTypes.func.isRequired,
  suggestions: PropTypes.object,
  isLoadingSuggestions: PropTypes.object,
  onRequestSuggestions: PropTypes.func.isRequired,
};
