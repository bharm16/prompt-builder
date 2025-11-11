import React from 'react';

/**
 * MeshGradientBackground - Subtle gradient background
 * 
 * Creates a subtle background for the wizard page.
 * 
 * @module MeshGradientBackground
 */
export const MeshGradientBackground = () => (
  <div 
    className="absolute inset-0 pointer-events-none" 
    style={{ 
      zIndex: 0,
      background: 'linear-gradient(135deg, #FAFAFA 0%, #F5F5F5 100%)'
    }}
  />
);

export default MeshGradientBackground;

