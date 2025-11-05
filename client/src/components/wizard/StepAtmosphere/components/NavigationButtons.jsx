/**
 * NavigationButtons - Back and Continue buttons for wizard navigation
 *
 * Styled navigation buttons with:
 * - Back button (secondary style)
 * - Continue button (primary gradient style with icon)
 * - Hover effects
 */

import React from 'react';
import PropTypes from 'prop-types';
import { ChevronRight } from 'lucide-react';
import { wizardTheme } from '../../../../styles/wizardTheme';

export function NavigationButtons({ onBack, onNext }) {
  return (
    <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      {/* Back Button */}
      <button
        onClick={onBack}
        style={{
          padding: '12px 24px',
          fontFamily: wizardTheme.fontFamily.primary,
          fontSize: '15px',
          fontWeight: 500,
          color: wizardTheme.colors.neutral[700],
          backgroundColor: wizardTheme.colors.neutral[100],
          borderRadius: wizardTheme.borderRadius.md,
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = wizardTheme.colors.neutral[200];
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = wizardTheme.colors.neutral[100];
        }}
      >
        Back
      </button>

      {/* Continue Button */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={onNext}
          style={{
            padding: '14px 32px',
            fontFamily: wizardTheme.fontFamily.primary,
            fontSize: wizardTheme.typography.button.fontSize,
            fontWeight: wizardTheme.typography.button.fontWeight,
            color: '#FFFFFF',
            background: `linear-gradient(135deg, ${wizardTheme.colors.accent.base} 0%, ${wizardTheme.colors.accent.hover} 100%)`,
            borderRadius: wizardTheme.borderRadius.lg,
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(255, 56, 92, 0.3)',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 56, 92, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 56, 92, 0.3)';
          }}
        >
          Continue
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

NavigationButtons.propTypes = {
  onBack: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired,
};

