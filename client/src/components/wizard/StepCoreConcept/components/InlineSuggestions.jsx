/**
 * InlineSuggestions - Chip-style suggestion buttons container
 *
 * Horizontal scrolling container for suggestion chips.
 * Handles both string and object {text, explanation} suggestion formats.
 *
 * @module InlineSuggestions
 */

import React from "react";
import PropTypes from "prop-types";
import { tokens } from "../config/designTokens";
import { SuggestionChip } from "./SuggestionChip";

/**
 * InlineSuggestions component
 * @param {Object} props
 * @param {Array} [props.suggestions=[]] - Array of suggestions (strings or {text, explanation} objects)
 * @param {boolean} props.isLoading - Loading state
 * @param {Function} props.onSelect - Suggestion selection handler
 * @param {Object} props.innerRef - Ref for blur handling
 */
export function InlineSuggestions({ suggestions = [], isLoading, onSelect, innerRef }) {
  if (isLoading) {
    return (
      <div
        ref={innerRef}
        style={{
          padding: `${tokens.space.sm} 0`,
          fontFamily: tokens.font.family.primary,
          fontSize: tokens.font.size.sm,
          color: tokens.color.ink[600],
        }}
      >
        Loading suggestions…
      </div>
    );
  }

  if (!suggestions.length) return null;

  return (
    <div
      ref={innerRef}
      role="list"
      aria-label="Suggestions"
      style={{
        display: "flex",
        gap: "8px",
        overflowX: "auto",
        overflowY: "hidden",
        marginTop: "16px",
        paddingBottom: "12px",
        // Custom scrollbar styling
        scrollbarWidth: "thin",
        scrollbarColor: `${tokens.color.gray[300]} ${tokens.color.gray[100]}`,
        WebkitOverflowScrolling: "touch",
      }}
    >
      {suggestions.map((suggestion, index) => {
        // Handle both string and object formats
        const text = typeof suggestion === 'string' ? suggestion : suggestion.text;
        const explanation = typeof suggestion === 'object' ? suggestion.explanation : null;

        return (
          <SuggestionChip
            key={`${text}-${index}`}
            text={text}
            explanation={explanation}
            onClick={() => onSelect?.(text)}
          />
        );
      })}
    </div>
  );
}

InlineSuggestions.propTypes = {
  suggestions: PropTypes.arrayOf(
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.shape({
        text: PropTypes.string.isRequired,
        explanation: PropTypes.string,
      })
    ])
  ),
  isLoading: PropTypes.bool,
  onSelect: PropTypes.func,
  innerRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any })
  ]),
};
