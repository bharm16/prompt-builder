/**
 * SuggestionChip - Individual suggestion button
 *
 * A pill-shaped button with hover states and optional tooltip.
 * Used within InlineSuggestions container.
 *
 * @module SuggestionChip
 */

import React, { useState } from "react";
import PropTypes from "prop-types";
import { tokens } from "../config/designTokens";

/**
 * SuggestionChip component
 * @param {Object} props
 * @param {string} props.text - Suggestion text to display
 * @param {string} [props.explanation] - Optional tooltip explanation
 * @param {Function} props.onClick - Click handler
 */
export function SuggestionChip({ text, explanation, onClick }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      type="button"
      role="listitem"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={explanation || undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "8px 16px",                            // Reduced from 16px 28px
        height: "32px",                                 // Reduced from 48px
        whiteSpace: "nowrap",                           // Prevent wrapping for horizontal scroll
        flexShrink: 0,                                  // Don't shrink in flex container
        fontFamily: tokens.font.family.primary,
        fontSize: "14px",                               // Reduced from 15px
        fontWeight: tokens.font.weight.medium,          // 500
        letterSpacing: tokens.font.letterSpacing.snug,  // -0.01em
        lineHeight: 1,                                  // Tighter line height
        color: tokens.color.gray[700],                  // #787878
        backgroundColor: isHovered ? tokens.color.accent.lightest : tokens.color.gray[50],
        border: `1.5px solid ${isHovered ? tokens.color.accent.base : tokens.color.gray[200]}`,
        borderRadius: "16px",                           // Pill shape (half of height)
        cursor: "pointer",
        transition: `all ${tokens.transition.fast}`,
        outline: "none",
        transform: isHovered ? "translateY(-1px)" : "translateY(0)",
        boxShadow: isHovered
          ? `0 2px 8px rgba(255, 56, 92, 0.2), 0 0 0 1px rgba(255, 56, 92, 0.1)`
          : "0 1px 2px rgba(0, 0, 0, 0.05)",
      }}
      onFocus={(e) => {
        e.currentTarget.style.outline = `2px solid ${tokens.color.accent.base}`;
        e.currentTarget.style.outlineOffset = "2px";
      }}
      onBlur={(e) => {
        e.currentTarget.style.outline = "none";
      }}
    >
      {text}
    </button>
  );
}

SuggestionChip.propTypes = {
  text: PropTypes.string.isRequired,
  explanation: PropTypes.string,
  onClick: PropTypes.func.isRequired,
};
