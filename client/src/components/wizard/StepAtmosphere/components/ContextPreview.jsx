/**
 * ContextPreview - Shows context from Step 1 (Core Concept)
 *
 * Displays subject, action, and location in a styled preview card
 * to remind users what they're building atmosphere for.
 */

import React from 'react';
import PropTypes from 'prop-types';
import { wizardTheme } from '../../../../styles/wizardTheme';

export function ContextPreview({ formData }) {
  return (
    <div
      style={{
        padding: '16px',
        marginBottom: '24px',
        backgroundColor: 'rgba(255, 56, 92, 0.05)',
        border: `2px solid ${wizardTheme.colors.accent.light}`,
        borderRadius: wizardTheme.borderRadius.md,
      }}
    >
      <p
        style={{
          margin: 0,
          marginBottom: '6px',
          fontFamily: wizardTheme.fontFamily.primary,
          fontSize: '13px',
          fontWeight: 600,
          color: wizardTheme.colors.neutral[700],
        }}
      >
        Creating:
      </p>
      <p
        style={{
          margin: 0,
          fontFamily: wizardTheme.fontFamily.primary,
          fontSize: '16px',
          color: wizardTheme.colors.neutral[700],
        }}
      >
        <span style={{ fontWeight: 500 }}>{formData.subject || '...'}</span>
        {' '}
        <span style={{ color: wizardTheme.colors.accent.base }}>
          {formData.action || '...'}
        </span>
        {' at '}
        <span style={{ fontWeight: 500 }}>{formData.location || '...'}</span>
      </p>
    </div>
  );
}

ContextPreview.propTypes = {
  formData: PropTypes.shape({
    subject: PropTypes.string,
    action: PropTypes.string,
    location: PropTypes.string,
  }).isRequired,
};

