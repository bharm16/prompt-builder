/**
 * PrimaryButton - Airbnb-style CTA button
 *
 * Full-featured primary action button with:
 * - Gradient background (Rausch pink)
 * - Hover/press states with smooth transitions
 * - Shadow elevation
 * - ChevronRight icon
 * - Disabled state
 * - Accessibility (ARIA, focus states)
 *
 * @module PrimaryButton
 */

import React, { useState } from "react";
import PropTypes from "prop-types";
import { ChevronRight } from "lucide-react";
import { tokens } from "../config/designTokens";

/**
 * PrimaryButton component
 * @param {Object} props
 * @param {React.ReactNode} props.children - Button text/content
 * @param {Function} [props.onClick] - Click handler
 * @param {boolean} [props.disabled=false] - Disabled state
 * @param {string} [props.ariaLabel] - ARIA label for accessibility
 * @param {boolean} [props.fullWidth=false] - Full width button
 */
export function PrimaryButton({ children, onClick, disabled, ariaLabel, fullWidth = false }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const baseStyles = {
    appearance: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.space.xs,
    width: fullWidth ? "100%" : "auto",
    height: "52px",                              // Exact height
    padding: `14px 32px`,                        // Exact padding
    fontFamily: tokens.font.family.primary,
    fontSize: tokens.font.size.button,           // 17px
    fontWeight: tokens.font.weight.semibold,     // 600
    letterSpacing: tokens.font.letterSpacing.snug, // -0.01em
    lineHeight: tokens.font.lineHeight.snug,     // 1.3
    border: "none",
    borderRadius: tokens.radius.lg,              // 12px (not pill)
    cursor: disabled ? "not-allowed" : "pointer",
    transition: `all ${tokens.transition.base}`,
    outline: "none",
  };

  const stateStyles = disabled
    ? {
        backgroundColor: tokens.color.gray[200],
        color: tokens.color.gray[500],
        boxShadow: "none",
      }
    : {
        background: isPressed
          ? `linear-gradient(135deg, ${tokens.color.accent.hover} 0%, #C12745 100%)`
          : isHovered
          ? `linear-gradient(135deg, ${tokens.color.accent.hover} 0%, #C12745 100%)`
          : `linear-gradient(135deg, ${tokens.color.accent.base} 0%, #C12745 100%)`,
        color: tokens.color.white,
        boxShadow: isPressed
          ? `0 2px 8px rgba(255, 56, 92, 0.3), 0 0 0 0 rgba(255, 56, 92, 0.1)`
          : isHovered
          ? `0 6px 20px rgba(255, 56, 92, 0.4), 0 0 0 0 rgba(255, 56, 92, 0.1)`
          : `0 4px 12px rgba(255, 56, 92, 0.3), 0 0 0 0 rgba(255, 56, 92, 0.1)`,
        transform: isHovered && !isPressed ? "translateY(-2px)" : "translateY(0)",
      };

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      style={{ ...baseStyles, ...stateStyles }}
      onMouseEnter={() => !disabled && setIsHovered(true)}
      onMouseLeave={() => {
        if (!disabled) {
          setIsHovered(false);
          setIsPressed(false);
        }
      }}
      onMouseDown={() => !disabled && setIsPressed(true)}
      onMouseUp={() => !disabled && setIsPressed(false)}
      onFocus={(e) => {
        if (!disabled) {
          e.currentTarget.style.outline = tokens.focus.outline;
          e.currentTarget.style.outlineOffset = tokens.focus.outlineOffset;
        }
      }}
      onBlur={(e) => {
        if (!disabled) {
          e.currentTarget.style.outline = "none";
        }
      }}
    >
      {children}
      <ChevronRight size={18} aria-hidden="true" />
    </button>
  );
}

PrimaryButton.propTypes = {
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func,
  disabled: PropTypes.bool,
  ariaLabel: PropTypes.string,
  fullWidth: PropTypes.bool,
};
