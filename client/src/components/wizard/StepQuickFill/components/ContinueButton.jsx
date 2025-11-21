/**
 * ContinueButton - Bento-styled continue button
 * 
 * Styled as a bento box but functions as a call-to-action button
 * Integrates seamlessly into the bento grid layout
 * 
 * @module ContinueButton
 */

import React from 'react';
import PropTypes from 'prop-types';
import { ChevronRight } from 'lucide-react';
import { wizardTheme } from '../../../../styles/wizardTheme';

/**
 * ContinueButton component
 */
export function ContinueButton({ onClick, disabled, mounted }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="continue-button-bento"
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'scale(1)' : 'scale(0.95)',
        transitionDelay: '450ms',
      }}
    >
      <div className="continue-button-bento__content">
        <span className="continue-button-bento__text">
          Continue to Summary
        </span>
        <ChevronRight 
          size={24} 
          className="continue-button-bento__icon"
        />
      </div>
    </button>
  );
}

ContinueButton.propTypes = {
  onClick: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  mounted: PropTypes.bool,
};

ContinueButton.defaultProps = {
  disabled: false,
  mounted: true,
};

export default ContinueButton;

