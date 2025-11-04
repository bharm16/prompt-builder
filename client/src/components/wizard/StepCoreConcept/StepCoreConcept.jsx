/**
 * StepCoreConcept - Core concept form orchestrator
 *
 * Wizard step for capturing the core concept of a video:
 * - Subject (required, min 3 chars)
 * - Descriptor 1-3 (optional, unlocked when subject valid)
 * - Action (required, min 3 chars, unlocked when subject valid)
 *
 * Features:
 * - Modern card-based UI with Airbnb DLS styling
 * - AI-powered suggestion pills
 * - Progressive field unlocking
 * - Responsive layout (mobile/tablet/desktop)
 * - Accessibility (ARIA, focus management)
 *
 * @module StepCoreConcept
 */

import React, { useState, useRef, useEffect } from "react";
import PropTypes from "prop-types";

// Configuration and utilities
import { tokens, injectGlobalStyles } from "./config/designTokens";
import { FIELD_CONFIG, SUCCESS_MESSAGE, BUTTON_CONFIG } from "./config/constants";

// Custom hooks
import { useCoreConceptForm } from "./hooks/useCoreConceptForm";
import { useResponsiveLayout } from "./hooks/useResponsiveLayout";

// Primitive components
import { SuccessBanner } from "./components/SuccessBanner";
import { PrimaryButton } from "./components/PrimaryButton";
import { TextField } from "./components/TextField";
import { InlineSuggestions } from "./components/InlineSuggestions";

/**
 * StepCoreConcept component
 * @param {Object} props
 * @param {Object} props.formData - Form data from parent wizard
 * @param {Function} props.onChange - Field change handler
 * @param {Function} props.onNext - Next step handler
 * @param {Object} [props.suggestions] - AI suggestions by field
 * @param {Object} [props.isLoadingSuggestions] - Loading state by field
 * @param {Function} [props.onRequestSuggestions] - Request suggestions handler
 */
export function StepCoreConcept({
  formData,
  onChange,
  onNext,
  suggestions,
  isLoadingSuggestions,
  onRequestSuggestions,
}) {
  // Inject global styles on mount
  useEffect(() => {
    injectGlobalStyles();
  }, []);

  // Use custom hooks
  const { validation, handlers } = useCoreConceptForm(formData, onChange);
  const { containerPadding, cardPadding } = useResponsiveLayout();

  // UI-specific state (active field tracking for showing only relevant suggestions)
  const [activeField, setActiveField] = useState(null);
  const suggestionsRef = useRef(null);

  const { isSubjectValid, isActionValid, showSuccessBanner } = validation;
  const { handleFieldChange, handleSuggestionSelect } = handlers;

  return (
    <main
      style={{
        flex: "1",
        width: "100%",
        maxWidth: "1920px",
        margin: "0 auto",
        padding: containerPadding,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "calc(100vh - 4px)", // Full viewport height minus progress bar
        background: "linear-gradient(to bottom right, #FAFAFA, #F7F7F7)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: "32px",            // 32px between heading and card
          maxWidth: "600px",
          width: "100%",
        }}
      >
        {/* Heading Section */}
        <section
          style={{
            textAlign: "center",
            width: "100%",
          }}
        >
          <h1
            style={{
              margin: 0,
              marginBottom: "16px",
              fontFamily: tokens.font.family.primary,
              fontSize: tokens.font.size.heading,         // 42px
              fontWeight: tokens.font.weight.bold,        // 700
              lineHeight: tokens.font.lineHeight.tight,   // 1.1
              letterSpacing: tokens.font.letterSpacing.tight, // -0.02em
              background: `linear-gradient(135deg, ${tokens.color.gray[800]} 0%, ${tokens.color.gray[600]} 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Let's start with the big idea
          </h1>
          <p
            style={{
              margin: 0,
              fontFamily: tokens.font.family.primary,
              fontSize: tokens.font.size.subheading,      // 18px
              fontWeight: tokens.font.weight.regular,     // 400
              lineHeight: tokens.font.lineHeight.relaxed, // 1.5
              color: tokens.color.gray[500],              // #B9B9B9
            }}
          >
            Tell us about the core of your video. We'll guide you through it step by step.
          </p>
        </section>

        {/* Form Card */}
        <section
          style={{
            width: "100%",
          }}
        >
          <div
            style={{
              backgroundColor: tokens.color.white,
              borderRadius: tokens.radius.xl,           // 16px for modern look
              border: `1px solid ${tokens.color.gray[200]}`,
              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05)",
              padding: cardPadding,
              width: "100%",
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            {/* Success Banner */}
            {showSuccessBanner && (
              <SuccessBanner message={SUCCESS_MESSAGE} />
            )}

            {/* Subject Field */}
            <TextField
              {...FIELD_CONFIG.subject}
              value={formData.subject}
              onChange={(e) => handleFieldChange("subject", e.target.value)}
              onFocus={() => {
                setActiveField("subject");
                onRequestSuggestions?.("subject", formData.subject || "");
              }}
              onBlur={(e) => {
                if (!suggestionsRef.current?.contains(e.relatedTarget)) {
                  setActiveField(null);
                }
              }}
              error={
                formData.subject && !isSubjectValid
                  ? "Please enter at least 3 characters"
                  : ""
              }
            />

            {activeField === "subject" && (
              <InlineSuggestions
                innerRef={suggestionsRef}
                suggestions={suggestions?.subject || []}
                isLoading={Boolean(isLoadingSuggestions?.subject)}
                onSelect={(text) => handleSuggestionSelect("subject", text)}
              />
            )}

            {/* Descriptor 1 Field */}
            <TextField
              {...FIELD_CONFIG.descriptor1}
              value={formData.descriptor1}
              onChange={(e) => handleFieldChange("descriptor1", e.target.value)}
              onFocus={() => {
                setActiveField("descriptor1");
                onRequestSuggestions?.("descriptor1", formData.descriptor1 || "");
              }}
              onBlur={(e) => {
                if (!suggestionsRef.current?.contains(e.relatedTarget)) {
                  setActiveField(null);
                }
              }}
              disabled={!isSubjectValid}
            />

            {activeField === "descriptor1" && (
              <InlineSuggestions
                innerRef={suggestionsRef}
                suggestions={suggestions?.descriptor1 || []}
                isLoading={Boolean(isLoadingSuggestions?.descriptor1)}
                onSelect={(text) => handleSuggestionSelect("descriptor1", text)}
              />
            )}

            {/* Descriptor 2 Field */}
            <TextField
              {...FIELD_CONFIG.descriptor2}
              value={formData.descriptor2}
              onChange={(e) => handleFieldChange("descriptor2", e.target.value)}
              onFocus={() => {
                setActiveField("descriptor2");
                onRequestSuggestions?.("descriptor2", formData.descriptor2 || "");
              }}
              onBlur={(e) => {
                if (!suggestionsRef.current?.contains(e.relatedTarget)) {
                  setActiveField(null);
                }
              }}
              disabled={!isSubjectValid}
            />

            {activeField === "descriptor2" && (
              <InlineSuggestions
                innerRef={suggestionsRef}
                suggestions={suggestions?.descriptor2 || []}
                isLoading={Boolean(isLoadingSuggestions?.descriptor2)}
                onSelect={(text) => handleSuggestionSelect("descriptor2", text)}
              />
            )}

            {/* Descriptor 3 Field */}
            <TextField
              {...FIELD_CONFIG.descriptor3}
              value={formData.descriptor3}
              onChange={(e) => handleFieldChange("descriptor3", e.target.value)}
              onFocus={() => {
                setActiveField("descriptor3");
                onRequestSuggestions?.("descriptor3", formData.descriptor3 || "");
              }}
              onBlur={(e) => {
                if (!suggestionsRef.current?.contains(e.relatedTarget)) {
                  setActiveField(null);
                }
              }}
              disabled={!isSubjectValid}
            />

            {activeField === "descriptor3" && (
              <InlineSuggestions
                innerRef={suggestionsRef}
                suggestions={suggestions?.descriptor3 || []}
                isLoading={Boolean(isLoadingSuggestions?.descriptor3)}
                onSelect={(text) => handleSuggestionSelect("descriptor3", text)}
              />
            )}

            {/* Action Field */}
            <TextField
              {...FIELD_CONFIG.action}
              value={formData.action}
              onChange={(e) => handleFieldChange("action", e.target.value)}
              onFocus={() => {
                setActiveField("action");
                if (isSubjectValid) {
                  onRequestSuggestions?.("action", formData.action || "");
                }
              }}
              onBlur={(e) => {
                if (!suggestionsRef.current?.contains(e.relatedTarget)) {
                  setActiveField(null);
                }
              }}
              error={
                formData.action && !isActionValid
                  ? "Please enter at least 3 characters"
                  : ""
              }
              disabled={!isSubjectValid}
            />

            {activeField === "action" && (
              <InlineSuggestions
                innerRef={suggestionsRef}
                suggestions={suggestions?.action || []}
                isLoading={Boolean(isLoadingSuggestions?.action)}
                onSelect={(text) => handleSuggestionSelect("action", text)}
              />
            )}

            {/* Next Button */}
            <div style={{ marginTop: "32px" }}>
              <PrimaryButton
                disabled={!isSubjectValid || !isActionValid}
                onClick={onNext}
                ariaLabel={BUTTON_CONFIG.nextButton.ariaLabel}
                fullWidth
              >
                {BUTTON_CONFIG.nextButton.label}
              </PrimaryButton>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

StepCoreConcept.propTypes = {
  formData: PropTypes.shape({
    subject: PropTypes.string,
    descriptor1: PropTypes.string,
    descriptor2: PropTypes.string,
    descriptor3: PropTypes.string,
    action: PropTypes.string,
  }).isRequired,
  onChange: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired,
  suggestions: PropTypes.object,
  isLoadingSuggestions: PropTypes.object,
  onRequestSuggestions: PropTypes.func,
};
