import React from 'react';

/**
 * MeshGradientBackground - Animated gradient blob background
 * 
 * Creates a subtle, animated mesh gradient effect using CSS-only blobs.
 * Uses mix-blend-multiply for organic color blending.
 * 
 * @module MeshGradientBackground
 */
export const MeshGradientBackground = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
    {/* Purple blob - top left */}
    <div 
      className="absolute top-0 left-1/4 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob"
    />
    
    {/* Yellow blob - top right */}
    <div 
      className="absolute top-0 right-1/4 w-96 h-96 bg-yellow-300 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob"
      style={{ animationDelay: '2s' }}
    />
    
    {/* Pink blob - bottom center */}
    <div 
      className="absolute bottom-0 left-1/2 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob"
      style={{ animationDelay: '4s' }}
    />
  </div>
);

export default MeshGradientBackground;

