/**
 * BentoGrid - Asymmetric grid container for bento fields
 * 
 * Features:
 * - CSS Grid with responsive breakpoints
 * - Large fields span 2 columns (required fields)
 * - Small fields span 1 column (optional fields)
 * - Auto-adjusts for tablet/mobile (all 1 column)
 * 
 * @module BentoGrid
 */

import React from 'react';
import PropTypes from 'prop-types';
import './BentoGrid.css';

/**
 * BentoGrid component
 * @param {Object} props
 * @param {React.ReactNode} props.children - BentoField components
 * @param {boolean} [props.mounted=true] - Animation state
 */
export function BentoGrid({ children, mounted = true }) {
  return (
    <div 
      className="bento-grid"
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(20px)',
      }}
    >
      {children}
    </div>
  );
}

BentoGrid.propTypes = {
  children: PropTypes.node.isRequired,
  mounted: PropTypes.bool,
};

