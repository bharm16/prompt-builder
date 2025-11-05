/**
 * StepAtmosphere Component - Desktop Step 2
 *
 * Displays 4 optional atmosphere fields:
 * - Time (when)
 * - Mood (emotional atmosphere)
 * - Style (visual treatment)
 * - Event (context/occasion)
 *
 * Shows context preview from Step 1
 * All fields are optional (can skip)
 * Inline suggestions for each field
 *
 * Refactored Architecture:
 * - Uses custom hooks for form logic and responsive layout
 * - Extracted field configuration to config/
 * - Reusable components for UI elements
 */

import React from 'react';
import PropTypes from 'prop-types';
import { wizardTheme } from '../../../styles/wizardTheme';
import { useAtmosphereForm } from './hooks/useAtmosphereForm';
import { useResponsiveLayout } from './hooks/useResponsiveLayout';
import { ATMOSPHERE_FIELDS } from './config/fieldConfig';
import { ContextPreview } from './components/ContextPreview';
import { AtmosphereField } from './components/AtmosphereField';
import { NavigationButtons } from './components/NavigationButtons';

const StepAtmosphere = ({
  formData,
  onChange,
  onNext,
  onBack,
  suggestions,
  isLoadingSuggestions,
  onRequestSuggestions,
}) => {
  // Custom hooks
  const { cardPadding, containerPadding } = useResponsiveLayout();
  const {
    activeField,
    handleFocus,
    handleChange,
    handleSuggestionSelect,
    handleKeyDown,
  } = useAtmosphereForm({
    formData,
    onChange,
    onRequestSuggestions,
    onNext,
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
        background: wizardTheme.colors.background.page,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '32px',
          maxWidth: '600px',
          width: '100%',
        }}
      >
        {/* Heading Section */}
        <section style={{ textAlign: 'center', width: '100%' }}>
          <h1
            style={{
              margin: 0,
              marginBottom: '16px',
              fontFamily: wizardTheme.fontFamily.primary,
              fontSize: wizardTheme.typography.heading.fontSize,
              fontWeight: wizardTheme.typography.heading.fontWeight,
              lineHeight: wizardTheme.typography.heading.lineHeight,
              letterSpacing: wizardTheme.typography.heading.letterSpacing,
              background: `linear-gradient(135deg, ${wizardTheme.colors.neutral[800]} 0%, ${wizardTheme.colors.neutral[600]} 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Atmosphere & Style
          </h1>
          <p
            style={{
              margin: 0,
              fontFamily: wizardTheme.fontFamily.primary,
              fontSize: wizardTheme.typography.subheading.fontSize,
              fontWeight: wizardTheme.typography.subheading.fontWeight,
              lineHeight: wizardTheme.typography.subheading.lineHeight,
              color: wizardTheme.colors.neutral[500],
            }}
          >
            Add depth to your scene with mood, timing, and style. All fields are optional.
          </p>
        </section>

        {/* Form Card */}
        <section style={{ width: '100%' }}>
          <div
            style={{
              backgroundColor: wizardTheme.colors.background.card,
              borderRadius: wizardTheme.borderRadius.xl,
              border: `1px solid ${wizardTheme.colors.neutral[200]}`,
              boxShadow:
                '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05)',
              padding: cardPadding,
              width: '100%',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            {/* Context Preview from Step 1 */}
            <ContextPreview formData={formData} />

            {/* Atmosphere Fields */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: wizardTheme.spacing.field.marginBottom,
              }}
            >
              {ATMOSPHERE_FIELDS.map((field) => (
                <AtmosphereField
                  key={field.name}
                  field={field}
                  value={formData[field.name] || ''}
                  isActive={activeField === field.name}
                  suggestions={suggestions[field.name]}
                  isLoadingSuggestions={isLoadingSuggestions[field.name]}
                  onFocus={handleFocus}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  onSuggestionSelect={handleSuggestionSelect}
                />
              ))}
            </div>

            {/* Navigation Buttons */}
            <NavigationButtons onBack={onBack} onNext={onNext} />
          </div>
        </section>
      </div>
    </main>
  );
};

StepAtmosphere.propTypes = {
  formData: PropTypes.shape({
    subject: PropTypes.string,
    action: PropTypes.string,
    descriptor1: PropTypes.string,
    descriptor2: PropTypes.string,
    descriptor3: PropTypes.string,
    location: PropTypes.string,
    time: PropTypes.string,
    mood: PropTypes.string,
    style: PropTypes.string,
    event: PropTypes.string,
  }).isRequired,
  onChange: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired,
  suggestions: PropTypes.object,
  isLoadingSuggestions: PropTypes.object,
  onRequestSuggestions: PropTypes.func.isRequired,
};

StepAtmosphere.defaultProps = {
  suggestions: {},
  isLoadingSuggestions: {},
};

export default StepAtmosphere;

