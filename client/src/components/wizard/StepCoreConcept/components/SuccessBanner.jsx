/**
 * SuccessBanner - Encouraging message when core fields complete
 *
 * A simple banner with check icon and success message, animated on display.
 *
 * @module SuccessBanner
 */

import React from "react";
import PropTypes from "prop-types";
import { Check } from "lucide-react";
import { tokens } from "../config/designTokens";

/**
 * SuccessBanner component
 * @param {Object} props
 * @param {string} props.message - Success message to display
 */
export function SuccessBanner({ message }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "12px",
        marginBottom: "16px",
        backgroundColor: tokens.color.success.light,
        border: `1px solid ${tokens.color.success.base}`,
        borderRadius: tokens.radius.md,
        animation: "fadeSlideIn 400ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <Check
        size={18}
        color={tokens.color.success.base}
        style={{
          flexShrink: 0,
        }}
        aria-hidden="true"
      />
      <span
        style={{
          fontFamily: tokens.font.family.primary,
          fontSize: tokens.font.size.hint,
          fontWeight: tokens.font.weight.medium,
          color: tokens.color.gray[800],
          lineHeight: 1.3,
        }}
      >
        {message}
      </span>
    </div>
  );
}

SuccessBanner.propTypes = {
  message: PropTypes.string.isRequired,
};
