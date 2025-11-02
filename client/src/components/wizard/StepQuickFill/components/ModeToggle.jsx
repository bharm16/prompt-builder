/**
 * ModeToggle - Quick Fill / Step-by-Step mode toggle
 *
 * Glassmorphism toggle switch for switching between modes.
 * Features:
 * - Glassmorphism background
 * - Animated toggle switch
 * - Hover effects
 * - Accessibility (ARIA labels)
 *
 * @module ModeToggle
 */

import React from 'react';
import PropTypes from 'prop-types';
import { wizardTheme } from '../../../../styles/wizardTheme';

/**
 * ModeToggle component
 * @param {Object} props
 * @param {Function} props.onSwitchToStepByStep - Handler for switching to step-by-step mode
 */
export function ModeToggle({ onSwitchToStepByStep }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 18px',
        background: 'rgba(247, 247, 247, 0.8)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRadius: '24px',
        border: '1px solid rgba(227, 227, 227, 0.6)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.06)',
      }}
    >
      <span
        style={{
          fontFamily: wizardTheme.fontFamily.primary,
          fontSize: '13px',
          fontWeight: 600,
          color: wizardTheme.colors.accent.base,
        }}
      >
        Quick Fill
      </span>
      <button
        onClick={onSwitchToStepByStep}
        style={{
          position: 'relative',
          width: '48px',
          height: '26px',
          backgroundColor: wizardTheme.colors.accent.base,
          borderRadius: '13px',
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          padding: 0,
          boxShadow: `0 0 0 0 ${wizardTheme.colors.accent.light}`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = `0 0 0 4px ${wizardTheme.colors.accent.light}`;
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = `0 0 0 0 ${wizardTheme.colors.accent.light}`;
          e.currentTarget.style.transform = 'scale(1)';
        }}
        aria-label="Switch to Step-by-Step mode"
        title="Switch to guided mode"
      >
        <span
          style={{
            position: 'absolute',
            top: '3px',
            left: '3px',
            width: '20px',
            height: '20px',
            backgroundColor: '#FFFFFF',
            borderRadius: '50%',
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
          }}
        />
      </button>
      <span
        style={{
          fontFamily: wizardTheme.fontFamily.primary,
          fontSize: '13px',
          fontWeight: 500,
          color: wizardTheme.colors.neutral[400],
        }}
      >
        Step-by-Step
      </span>
    </div>
  );
}

ModeToggle.propTypes = {
  onSwitchToStepByStep: PropTypes.func.isRequired,
};
