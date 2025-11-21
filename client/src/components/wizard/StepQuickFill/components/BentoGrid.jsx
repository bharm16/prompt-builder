/**
 * BentoGrid - Tailwind UI style layered bento grid
 * 
 * Features:
 * - Explicit 3-column, 2-row grid (lg breakpoint)
 * - Tailwind utility classes for responsive design
 * - Mobile-first with max-lg modifiers
 * - Staggered entrance animations
 * 
 * @module BentoGrid
 */

import React from 'react';
import PropTypes from 'prop-types';

/**
 * BentoGrid component
 * @param {Object} props
 * @param {React.ReactNode} props.children - BentoField components
 * @param {boolean} [props.mounted=true] - Animation state
 */
export function BentoGrid({ children, mounted = true }) {
  return (
    <div 
      className="mt-10 grid gap-4 sm:mt-16 lg:grid-cols-3"
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(20px)',
        transition: 'all 400ms cubic-bezier(0.4, 0, 0.2, 1)',
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

