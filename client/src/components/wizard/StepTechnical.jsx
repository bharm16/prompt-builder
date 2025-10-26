/**
 * StepTechnical - 2025 Redesign
 *
 * Modern, minimalist technical parameters step with accordion categories.
 *
 * Design Principles Applied:
 * - Neutral color palette (matching PromptCanvas & StepCoreConcept)
 * - System font stack for native feel
 * - Micro-interactions and smooth transitions
 * - Accessibility-first (WCAG 2.1 AA)
 * - Progressive disclosure through opacity
 * - Minimal, clean interface
 * - Lucide React icons for consistency
 *
 * @version 3.0.0
 */

import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Camera, Lightbulb, ChevronDown, ChevronRight, Check } from 'lucide-react';

// ============================================================================
// DESIGN TOKENS - 2025 Minimalist System (matches PromptCanvas)
// ============================================================================

const tokens = {
  // System font stack (matches PromptCanvas exactly)
  font: {
    family: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
    size: {
      xs: '0.75rem',      // 12px
      sm: '0.8125rem',    // 13px
      base: '0.875rem',   // 14px
      md: '0.9375rem',    // 15px
      lg: '1rem',         // 16px
      xl: '1.125rem',     // 18px
      xxl: '1.25rem',     // 20px
      xxxl: '1.5rem',     // 24px
      display: '2rem',    // 32px
      hero: '2.25rem',    // 36px
    },
    weight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      snug: 1.375,
      normal: 1.5,
      relaxed: 1.6,
      loose: 1.75,
    },
    letterSpacing: {
      tight: '-0.02em',
      normal: '-0.01em',
      wide: '0.025em',
    },
  },

  // Neutral color palette (matches PromptCanvas)
  color: {
    neutral: {
      50: '#FAFAFA',
      100: '#F5F5F5',
      200: '#E5E5E5',
      300: '#D4D4D4',
      400: '#A3A3A3',
      500: '#737373',
      600: '#525252',
      700: '#404040',
      800: '#262626',
      900: '#171717',
    },
    success: {
      50: '#F0FDF4',
      100: '#DCFCE7',
      500: '#22C55E',
      600: '#16A34A',
      700: '#15803D',
    },
    white: '#FFFFFF',
  },

  // Spacing scale
  space: {
    1: '0.25rem',   // 4px
    2: '0.5rem',    // 8px
    3: '0.75rem',   // 12px
    4: '1rem',      // 16px
    5: '1.25rem',   // 20px
    6: '1.5rem',    // 24px
    8: '2rem',      // 32px
    10: '2.5rem',   // 40px
    12: '3rem',     // 48px
    16: '4rem',     // 64px
  },

  // Border radius
  radius: {
    sm: '0.25rem',  // 4px
    md: '0.375rem', // 6px
    lg: '0.5rem',   // 8px
    xl: '0.75rem',  // 12px
  },

  // Shadows (subtle, matching PromptCanvas)
  shadow: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
  },

  // Transitions (smooth, delightful micro-interactions)
  transition: {
    fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    base: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
};

// ============================================================================
// CATEGORY ICON MAPPING (Using Lucide React)
// ============================================================================

const categoryIcons = {
  camera: Camera,
  lighting: Lightbulb,
  composition: Camera,
  motion: Camera,
  effects: Camera,
};

// ============================================================================
// COMPONENTS
// ============================================================================

/**
 * TextField - Modern minimalist input field
 * Features: Clean borders, subtle focus states, micro-interactions
 */
function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div>
      {/* Label */}
      <label
        htmlFor={id}
        style={{
          display: 'block',
          fontFamily: tokens.font.family,
          fontSize: tokens.font.size.xl,
          fontWeight: tokens.font.weight.semibold,
          color: tokens.color.neutral[900],
          marginBottom: tokens.space[2],
          lineHeight: tokens.font.lineHeight.snug,
          letterSpacing: tokens.font.letterSpacing.tight,
          transition: `color ${tokens.transition.base}`,
        }}
      >
        {label}
      </label>

      {/* Input */}
      <input
        id={id}
        type="text"
        value={value ?? ''}
        onChange={onChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: tokens.space[4],
          fontFamily: tokens.font.family,
          fontSize: tokens.font.size.lg,
          lineHeight: tokens.font.lineHeight.relaxed,
          color: tokens.color.neutral[900],
          backgroundColor: tokens.color.white,
          border: `1px solid ${
            isFocused
              ? tokens.color.neutral[900]
              : isHovered
              ? tokens.color.neutral[400]
              : tokens.color.neutral[300]
          }`,
          borderRadius: tokens.radius.lg,
          outline: 'none',
          transition: `all ${tokens.transition.base}`,
          boxShadow: isFocused ? `0 0 0 2px ${tokens.color.neutral[900]}` : 'none',
        }}
      />
    </div>
  );
}

TextField.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
};

/**
 * PresetCard - Modern preset selection card
 */
function PresetCard({ preset, isSelected, onClick }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        padding: tokens.space[5],
        backgroundColor: isSelected ? tokens.color.neutral[50] : tokens.color.white,
        border: `1px solid ${
          isSelected
            ? tokens.color.neutral[900]
            : isHovered
            ? tokens.color.neutral[400]
            : tokens.color.neutral[200]
        }`,
        borderRadius: tokens.radius.lg,
        cursor: 'pointer',
        transition: `all ${tokens.transition.base}`,
        outline: 'none',
        transform: isPressed ? 'scale(0.98)' : isHovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: isHovered ? tokens.shadow.md : tokens.shadow.sm,
      }}
      onFocus={(e) => {
        e.currentTarget.style.outline = `2px solid ${tokens.color.neutral[400]}`;
        e.currentTarget.style.outlineOffset = '2px';
      }}
      onBlur={(e) => {
        e.currentTarget.style.outline = 'none';
      }}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div
          style={{
            position: 'absolute',
            top: tokens.space[3],
            right: tokens.space[3],
            width: '20px',
            height: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: tokens.color.neutral[900],
            borderRadius: '50%',
            color: tokens.color.white,
          }}
        >
          <Check size={14} strokeWidth={3} />
        </div>
      )}

      {/* Preset name */}
      <h4
        style={{
          margin: 0,
          marginBottom: tokens.space[1],
          fontFamily: tokens.font.family,
          fontSize: tokens.font.size.lg,
          fontWeight: tokens.font.weight.semibold,
          color: tokens.color.neutral[900],
          lineHeight: tokens.font.lineHeight.snug,
        }}
      >
        {preset.name}
      </h4>

      {/* Preset description */}
      <p
        style={{
          margin: 0,
          fontFamily: tokens.font.family,
          fontSize: tokens.font.size.sm,
          color: tokens.color.neutral[600],
          lineHeight: tokens.font.lineHeight.relaxed,
        }}
      >
        {preset.description}
      </p>
    </button>
  );
}

PresetCard.propTypes = {
  preset: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
  }).isRequired,
  isSelected: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
};

/**
 * CategoryAccordion - Collapsible category section
 */
function CategoryAccordion({ category, isExpanded, onToggle, filledCount, children }) {
  const [isHovered, setIsHovered] = useState(false);
  const IconComponent = categoryIcons[category.id] || Camera;

  return (
    <div
      style={{
        backgroundColor: tokens.color.white,
        border: `1px solid ${isExpanded ? tokens.color.neutral[300] : tokens.color.neutral[200]}`,
        borderRadius: tokens.radius.lg,
        overflow: 'hidden',
        transition: `all ${tokens.transition.base}`,
        boxShadow: isExpanded ? tokens.shadow.base : 'none',
      }}
    >
      {/* Category Header */}
      <button
        type="button"
        onClick={onToggle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${tokens.space[5]} ${tokens.space[6]}`,
          backgroundColor: isHovered ? tokens.color.neutral[50] : tokens.color.white,
          border: 'none',
          cursor: 'pointer',
          transition: `background-color ${tokens.transition.base}`,
          outline: 'none',
        }}
        onFocus={(e) => {
          e.currentTarget.style.outline = `2px solid ${tokens.color.neutral[400]}`;
          e.currentTarget.style.outlineOffset = '-2px';
        }}
        onBlur={(e) => {
          e.currentTarget.style.outline = 'none';
        }}
      >
        {/* Left side: Icon and text */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: tokens.space[4],
          }}
        >
          {/* Icon */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              backgroundColor: tokens.color.neutral[100],
              borderRadius: tokens.radius.lg,
              color: tokens.color.neutral[700],
              transition: `all ${tokens.transition.base}`,
            }}
          >
            <IconComponent size={20} strokeWidth={2} />
          </div>

          {/* Text content */}
          <div style={{ textAlign: 'left' }}>
            <h3
              style={{
                margin: 0,
                marginBottom: tokens.space[1],
                fontFamily: tokens.font.family,
                fontSize: tokens.font.size.xl,
                fontWeight: tokens.font.weight.semibold,
                color: tokens.color.neutral[900],
                lineHeight: tokens.font.lineHeight.snug,
              }}
            >
              {category.name}
            </h3>
            <p
              style={{
                margin: 0,
                fontFamily: tokens.font.family,
                fontSize: tokens.font.size.sm,
                color: tokens.color.neutral[600],
                lineHeight: tokens.font.lineHeight.relaxed,
              }}
            >
              {category.description}
            </p>
          </div>
        </div>

        {/* Right side: Badge and chevron */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: tokens.space[3],
          }}
        >
          {/* Filled count badge */}
          {filledCount > 0 && (
            <div
              style={{
                padding: `${tokens.space[1]} ${tokens.space[3]}`,
                backgroundColor: tokens.color.neutral[100],
                borderRadius: tokens.radius.xl,
                fontFamily: tokens.font.family,
                fontSize: tokens.font.size.xs,
                fontWeight: tokens.font.weight.semibold,
                color: tokens.color.neutral[700],
                letterSpacing: tokens.font.letterSpacing.wide,
              }}
            >
              {filledCount} SET
            </div>
          )}

          {/* Chevron */}
          <div
            style={{
              color: tokens.color.neutral[500],
              transition: `transform ${tokens.transition.base}`,
              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
          >
            <ChevronRight size={20} strokeWidth={2} />
          </div>
        </div>
      </button>

      {/* Category Content */}
      {isExpanded && (
        <div
          style={{
            padding: `${tokens.space[6]} ${tokens.space[6]} ${tokens.space[8]}`,
            backgroundColor: tokens.color.neutral[50],
            borderTop: `1px solid ${tokens.color.neutral[200]}`,
            animation: 'slideDown 300ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

CategoryAccordion.propTypes = {
  category: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
  }).isRequired,
  isExpanded: PropTypes.bool,
  onToggle: PropTypes.func.isRequired,
  filledCount: PropTypes.number,
  children: PropTypes.node,
};

/**
 * PrimaryButton - Modern CTA button
 */
function PrimaryButton({ children, onClick, variant = 'primary' }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const isGhost = variant === 'ghost';

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      style={{
        padding: `${tokens.space[4]} ${tokens.space[6]}`,
        fontFamily: tokens.font.family,
        fontSize: tokens.font.size.lg,
        fontWeight: tokens.font.weight.semibold,
        color: isPrimary
          ? tokens.color.white
          : isSecondary
          ? tokens.color.neutral[900]
          : tokens.color.neutral[700],
        backgroundColor: isPrimary
          ? isPressed
            ? tokens.color.neutral[800]
            : isHovered
            ? tokens.color.neutral[800]
            : tokens.color.neutral[900]
          : isSecondary
          ? isHovered
            ? tokens.color.neutral[100]
            : tokens.color.neutral[50]
          : 'transparent',
        border: isGhost ? 'none' : `1px solid ${isSecondary ? tokens.color.neutral[300] : 'transparent'}`,
        borderRadius: tokens.radius.lg,
        cursor: 'pointer',
        transition: `all ${tokens.transition.base}`,
        outline: 'none',
        transform: isPressed ? 'translateY(0)' : isHovered && isPrimary ? 'translateY(-1px)' : 'translateY(0)',
        boxShadow: isPrimary
          ? isPressed
            ? 'none'
            : isHovered
            ? tokens.shadow.md
            : tokens.shadow.sm
          : 'none',
      }}
      onFocus={(e) => {
        e.currentTarget.style.outline = `2px solid ${tokens.color.neutral[400]}`;
        e.currentTarget.style.outlineOffset = '2px';
      }}
      onBlur={(e) => {
        e.currentTarget.style.outline = 'none';
      }}
    >
      {children}
    </button>
  );
}

PrimaryButton.propTypes = {
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func.isRequired,
  variant: PropTypes.oneOf(['primary', 'secondary', 'ghost']),
};

/**
 * HelpBox - Modern help text component
 */
function HelpBox({ children }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: tokens.space[3],
        padding: `${tokens.space[5]} ${tokens.space[6]}`,
        backgroundColor: tokens.color.neutral[50],
        border: `1px solid ${tokens.color.neutral[200]}`,
        borderRadius: tokens.radius.lg,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          width: '20px',
          height: '20px',
          marginTop: '2px',
          color: tokens.color.neutral[600],
        }}
      >
        <Lightbulb size={18} strokeWidth={2} />
      </div>
      <p
        style={{
          margin: 0,
          fontFamily: tokens.font.family,
          fontSize: tokens.font.size.md,
          color: tokens.color.neutral[700],
          lineHeight: tokens.font.lineHeight.relaxed,
        }}
      >
        {children}
      </p>
    </div>
  );
}

HelpBox.propTypes = {
  children: PropTypes.node.isRequired,
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * StepTechnical Component - Desktop Step 3
 *
 * Advanced technical parameters with collapsible categories:
 * - Camera (angle, distance, movement, lens, focus)
 * - Lighting (quality, direction, color, intensity)
 * - Composition (framing, aspect ratio)
 * - Motion (speed, smoothness)
 * - Effects (post-production)
 *
 * All parameters are optional
 * Collapsible categories (collapsed by default)
 * Preset buttons for common configurations
 */
const StepTechnical = ({
  formData,
  onChange,
  onNext,
  onBack
}) => {
  const [expandedCategories, setExpandedCategories] = useState({});
  const [selectedPreset, setSelectedPreset] = useState(null);

  // Technical categories configuration
  const categories = [
    {
      id: 'camera',
      name: 'Camera Settings',
      description: 'Camera angles, movements, and lens choices',
      fields: [
        { name: 'angle', label: 'Camera Angle', placeholder: 'e.g., eye-level, low angle, bird\'s eye view' },
        { name: 'distance', label: 'Camera Distance', placeholder: 'e.g., close-up, medium shot, wide shot' },
        { name: 'movement', label: 'Camera Movement', placeholder: 'e.g., static, tracking, dolly zoom' },
        { name: 'lens', label: 'Lens Type', placeholder: 'e.g., 50mm, wide-angle, telephoto' },
        { name: 'focusType', label: 'Focus', placeholder: 'e.g., shallow depth of field, deep focus' }
      ]
    },
    {
      id: 'lighting',
      name: 'Lighting',
      description: 'Light quality, direction, and color',
      fields: [
        { name: 'quality', label: 'Light Quality', placeholder: 'e.g., soft, hard, diffused' },
        { name: 'direction', label: 'Light Direction', placeholder: 'e.g., front-lit, backlit, side-lit' },
        { name: 'color', label: 'Light Color', placeholder: 'e.g., warm, cool, natural' },
        { name: 'intensity', label: 'Intensity', placeholder: 'e.g., bright, dim, dramatic' }
      ]
    },
    {
      id: 'composition',
      name: 'Composition',
      description: 'Framing and visual structure',
      fields: [
        { name: 'framing', label: 'Framing', placeholder: 'e.g., rule of thirds, centered, symmetrical' },
        { name: 'aspectRatio', label: 'Aspect Ratio', placeholder: 'e.g., 16:9, 9:16, cinematic 2.39:1' }
      ]
    },
    {
      id: 'motion',
      name: 'Motion & Pace',
      description: 'Speed and smoothness of movement',
      fields: [
        { name: 'speed', label: 'Motion Speed', placeholder: 'e.g., slow motion, normal speed, time-lapse' },
        { name: 'smoothness', label: 'Smoothness', placeholder: 'e.g., smooth, handheld, steady' }
      ]
    },
    {
      id: 'effects',
      name: 'Effects & Style',
      description: 'Post-production and visual effects',
      fields: [
        { name: 'colorGrading', label: 'Color Grading', placeholder: 'e.g., vibrant, desaturated, vintage' },
        { name: 'visualEffects', label: 'Visual Effects', placeholder: 'e.g., lens flare, particles, bloom' }
      ]
    }
  ];

  // Preset configurations
  const presets = [
    {
      id: 'cinematic',
      name: 'Cinematic',
      description: 'Film-like quality with dramatic lighting',
      values: {
        camera: { angle: 'eye-level', distance: 'medium shot', lens: '35mm' },
        lighting: { quality: 'soft', direction: 'side-lit', color: 'warm' },
        composition: { aspectRatio: 'cinematic 2.39:1' }
      }
    },
    {
      id: 'documentary',
      name: 'Documentary',
      description: 'Natural and realistic approach',
      values: {
        camera: { movement: 'handheld', distance: 'medium shot' },
        lighting: { quality: 'natural', color: 'neutral' },
        motion: { smoothness: 'handheld' }
      }
    },
    {
      id: 'commercial',
      name: 'Commercial',
      description: 'Polished and vibrant',
      values: {
        camera: { movement: 'smooth tracking', lens: '50mm' },
        lighting: { quality: 'soft', intensity: 'bright' },
        effects: { colorGrading: 'vibrant and saturated' }
      }
    },
    {
      id: 'music-video',
      name: 'Music Video',
      description: 'Dynamic and creative',
      values: {
        camera: { movement: 'dynamic tracking', angle: 'varied angles' },
        lighting: { color: 'colorful', intensity: 'dramatic' },
        motion: { speed: 'varied pace' }
      }
    }
  ];

  // Toggle category expansion
  const toggleCategory = useCallback((categoryId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  }, []);

  // Apply preset
  const applyPreset = useCallback((preset) => {
    setSelectedPreset(preset.id);
    // Apply all preset values
    Object.entries(preset.values).forEach(([categoryId, fields]) => {
      Object.entries(fields).forEach(([fieldName, value]) => {
        onChange(`${categoryId}.${fieldName}`, value);
      });
    });
    // Expand categories that have values
    const newExpanded = {};
    Object.keys(preset.values).forEach(categoryId => {
      newExpanded[categoryId] = true;
    });
    setExpandedCategories(newExpanded);
  }, [onChange]);

  // Handle field change
  const handleFieldChange = useCallback((categoryId, fieldName, value) => {
    onChange(`${categoryId}.${fieldName}`, value);
    setSelectedPreset(null); // Clear preset selection when manually changing
  }, [onChange]);

  // Count filled fields in a category
  const getFilledFieldsCount = useCallback((category) => {
    const categoryData = formData[category.id] || {};
    return category.fields.filter(field => categoryData[field.name]).length;
  }, [formData]);

  // Calculate total filled technical parameters
  const getTotalFilledParams = useCallback(() => {
    let count = 0;
    categories.forEach(category => {
      count += getFilledFieldsCount(category);
    });
    return count;
  }, [categories, getFilledFieldsCount]);

  const totalParams = getTotalFilledParams();

  return (
    <>
      {/* Keyframe animations */}
      <style>
        {`
          @keyframes slideDown {
            from {
              opacity: 0;
              transform: translateY(-8px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>

      <div
        style={{
          maxWidth: '800px',
          margin: '0 auto',
          padding: `${tokens.space[10]} ${tokens.space[8]}`,
        }}
      >
        {/* Step Header */}
        <header
          style={{
            marginBottom: tokens.space[10],
          }}
        >
          <h1
            style={{
              margin: 0,
              marginBottom: tokens.space[2],
              fontFamily: tokens.font.family,
              fontSize: tokens.font.size.hero,
              lineHeight: tokens.font.lineHeight.tight,
              letterSpacing: tokens.font.letterSpacing.tight,
              fontWeight: tokens.font.weight.bold,
              color: tokens.color.neutral[900],
            }}
          >
            Want to get technical?
          </h1>
          <p
            style={{
              margin: 0,
              fontFamily: tokens.font.family,
              fontSize: tokens.font.size.xl,
              lineHeight: tokens.font.lineHeight.relaxed,
              color: tokens.color.neutral[600],
              letterSpacing: tokens.font.letterSpacing.normal,
            }}
          >
            These advanced settings are completely optional. Most people skip this step and still get amazing results!
          </p>
          {totalParams > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: tokens.space[2],
                marginTop: tokens.space[4],
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: tokens.color.success[600],
                }}
              >
                <Check size={18} strokeWidth={2.5} />
              </div>
              <p
                style={{
                  margin: 0,
                  fontFamily: tokens.font.family,
                  fontSize: tokens.font.size.md,
                  fontWeight: tokens.font.weight.medium,
                  color: tokens.color.success[700],
                  lineHeight: tokens.font.lineHeight.relaxed,
                }}
              >
                Nice! You've configured {totalParams} parameter{totalParams !== 1 ? 's' : ''}.
              </p>
            </div>
          )}
        </header>

        {/* Preset Buttons */}
        <section
          style={{
            marginBottom: tokens.space[10],
          }}
        >
          <h2
            style={{
              margin: 0,
              marginBottom: tokens.space[4],
              fontFamily: tokens.font.family,
              fontSize: tokens.font.size.base,
              fontWeight: tokens.font.weight.semibold,
              color: tokens.color.neutral[600],
              textTransform: 'uppercase',
              letterSpacing: tokens.font.letterSpacing.wide,
            }}
          >
            Quick Presets
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: tokens.space[4],
            }}
          >
            {presets.map((preset) => (
              <PresetCard
                key={preset.id}
                preset={preset}
                isSelected={selectedPreset === preset.id}
                onClick={() => applyPreset(preset)}
              />
            ))}
          </div>
        </section>

        {/* Technical Categories */}
        <section
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: tokens.space[6],
            marginBottom: tokens.space[10],
          }}
        >
          {categories.map((category) => {
            const isExpanded = expandedCategories[category.id];
            const filledCount = getFilledFieldsCount(category);
            const categoryData = formData[category.id] || {};

            return (
              <CategoryAccordion
                key={category.id}
                category={category}
                isExpanded={isExpanded}
                onToggle={() => toggleCategory(category.id)}
                filledCount={filledCount}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: tokens.space[6],
                  }}
                >
                  {category.fields.map((field) => (
                    <TextField
                      key={field.name}
                      id={`${category.id}-${field.name}`}
                      label={field.label}
                      value={categoryData[field.name] || ''}
                      onChange={(e) => handleFieldChange(category.id, field.name, e.target.value)}
                      placeholder={field.placeholder}
                    />
                  ))}
                </div>
              </CategoryAccordion>
            );
          })}
        </section>

        {/* Help Text */}
        <HelpBox>
          <strong>Feeling confident?</strong> These technical controls let you fine-tune every detail. But don't worry—your creative brief is already powerful enough to create something amazing!
        </HelpBox>

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: tokens.space[10],
            gap: tokens.space[4],
          }}
        >
          <PrimaryButton onClick={onBack} variant="ghost">
            Back to Creative Brief
          </PrimaryButton>

          <div
            style={{
              display: 'flex',
              gap: tokens.space[3],
            }}
          >
            <PrimaryButton onClick={onNext} variant="secondary">
              Skip Technical
            </PrimaryButton>
            <PrimaryButton onClick={onNext} variant="primary">
              Review & Generate
            </PrimaryButton>
          </div>
        </div>
      </div>
    </>
  );
};

StepTechnical.propTypes = {
  formData: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired
};

export default StepTechnical;
