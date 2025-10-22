/**
 * Debug Button Component
 *
 * Add this to PromptOptimizerContainer.jsx to enable one-click debugging:
 *
 * import DebugButton from '../components/DebugButton';
 *
 * <DebugButton
 *   inputPrompt={promptOptimizer.inputPrompt}
 *   displayedPrompt={promptOptimizer.displayedPrompt}
 *   optimizedPrompt={promptOptimizer.optimizedPrompt}
 *   selectedMode={selectedMode}
 *   promptContext={promptContext}
 * />
 */

import React from 'react';
import { usePromptDebugger } from '../hooks/usePromptDebugger';

export default function DebugButton({
  inputPrompt,
  displayedPrompt,
  optimizedPrompt,
  selectedMode,
  promptContext,
  style = {},
  className = ''
}) {
  const { capturePromptData, exportToFile, isCapturing } = usePromptDebugger({
    inputPrompt,
    displayedPrompt,
    optimizedPrompt,
    selectedMode,
    promptContext
  });

  const handleCapture = async () => {
    try {
      await capturePromptData();
      // Data is automatically logged to console and saved
    } catch (error) {
      console.error('Failed to capture debug data:', error);
      alert('Failed to capture debug data. Check console for details.');
    }
  };

  const handleExport = () => {
    try {
      exportToFile();
    } catch (error) {
      console.error('Failed to export debug data:', error);
      alert('No debug data to export. Capture data first.');
    }
  };

  return (
    <div
      className={`debug-button-container ${className}`}
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        display: 'flex',
        gap: '10px',
        zIndex: 9999,
        ...style
      }}
    >
      <button
        onClick={handleCapture}
        disabled={isCapturing}
        style={{
          padding: '10px 16px',
          backgroundColor: isCapturing ? '#6b7280' : '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: isCapturing ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: '500',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
        onMouseEnter={(e) => {
          if (!isCapturing) {
            e.target.style.backgroundColor = '#2563eb';
            e.target.style.transform = 'translateY(-1px)';
            e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isCapturing) {
            e.target.style.backgroundColor = '#3b82f6';
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
          }
        }}
        title="Capture prompt data with all highlights and AI suggestions"
      >
        {isCapturing ? (
          <>
            <span className="spinner">⏳</span>
            <span>Capturing...</span>
          </>
        ) : (
          <>
            <span>🔍</span>
            <span>Debug Capture</span>
          </>
        )}
      </button>

      <button
        onClick={handleExport}
        style={{
          padding: '10px 16px',
          backgroundColor: '#10b981',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '500',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
        onMouseEnter={(e) => {
          e.target.style.backgroundColor = '#059669';
          e.target.style.transform = 'translateY(-1px)';
          e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
        }}
        onMouseLeave={(e) => {
          e.target.style.backgroundColor = '#10b981';
          e.target.style.transform = 'translateY(0)';
          e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
        }}
        title="Export last capture to JSON file"
      >
        <span>💾</span>
        <span>Export JSON</span>
      </button>
    </div>
  );
}
