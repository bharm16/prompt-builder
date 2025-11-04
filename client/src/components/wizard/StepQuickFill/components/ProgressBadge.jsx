/**
 * ProgressBadge - Completion progress indicator
 *
 * Displays filled fields count and visual progress bar with Sparkles icon.
 * Uses gradient background and smooth progress bar animation.
 *
 * @module ProgressBadge
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Sparkles } from 'lucide-react';
import { wizardTheme } from '../../../../styles/wizardTheme';

/**
 * ProgressBadge component
 * @param {Object} props
 * @param {number} props.filledFields - Number of filled fields
 * @param {number} props.totalFields - Total number of fields
 * @param {number} props.completionPercentage - Completion percentage (0-100)
 */
export function ProgressBadge({ filledFields, totalFields, completionPercentage }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '12px',
        padding: '8px 20px',
        background: 'linear-gradient(135deg, rgba(255, 56, 92, 0.08) 0%, rgba(255, 56, 92, 0.12) 100%)',
        borderRadius: '24px',
        border: `1px solid ${wizardTheme.colors.accent.lighter}`,
      }}
    >
      <Sparkles size={16} color={wizardTheme.colors.accent.base} />
      <span
        style={{
          fontFamily: wizardTheme.fontFamily.primary,
          fontSize: '14px',
          fontWeight: 600,
          color: wizardTheme.colors.neutral[700],
        }}
      >
        {filledFields}/{totalFields} fields completed
      </span>
      <div
        style={{
          width: '60px',
          height: '6px',
          background: wizardTheme.colors.neutral[200],
          borderRadius: '3px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${completionPercentage}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${wizardTheme.colors.accent.base} 0%, ${wizardTheme.colors.accent.hover} 100%)`,
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            borderRadius: '3px',
          }}
        />
      </div>
    </div>
  );
}

ProgressBadge.propTypes = {
  filledFields: PropTypes.number.isRequired,
  totalFields: PropTypes.number.isRequired,
  completionPercentage: PropTypes.number.isRequired,
};
