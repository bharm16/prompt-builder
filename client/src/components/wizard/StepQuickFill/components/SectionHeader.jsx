/**
 * SectionHeader - Section title with icon
 *
 * Displays a section header with:
 * - Gradient icon background
 * - Title and subtitle
 * - Bottom border
 *
 * Used for "Core Concept" and "Atmosphere & Style" sections.
 *
 * @module SectionHeader
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Zap, Sparkles } from 'lucide-react';
import { wizardTheme } from '../../../../styles/wizardTheme';

// Icon mapping
const ICON_MAP = {
  zap: Zap,
  sparkles: Sparkles,
};

/**
 * SectionHeader component
 * @param {Object} props
 * @param {string} props.icon - Icon name ('zap' or 'sparkles')
 * @param {string} props.iconBg - Icon background gradient
 * @param {string} props.iconShadow - Icon shadow color
 * @param {string} props.title - Section title
 * @param {string} props.subtitle - Section subtitle
 */
export function SectionHeader({ icon, iconBg, iconShadow, title, subtitle }) {
  const IconComponent = ICON_MAP[icon] || Zap;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '28px',
        paddingBottom: '16px',
        borderBottom: `2px solid ${wizardTheme.colors.neutral[100]}`,
      }}
    >
      <div
        style={{
          width: '40px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: iconBg,
          borderRadius: '10px',
          boxShadow: `0 4px 12px ${iconShadow}`,
        }}
      >
        <IconComponent size={20} color="#FFFFFF" strokeWidth={2.5} />
      </div>
      <div>
        <h2
          style={{
            margin: 0,
            fontFamily: wizardTheme.fontFamily.primary,
            fontSize: '22px',
            fontWeight: 700,
            color: wizardTheme.colors.neutral[900],
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </h2>
        <p
          style={{
            margin: 0,
            fontFamily: wizardTheme.fontFamily.primary,
            fontSize: '13px',
            color: wizardTheme.colors.neutral[500],
          }}
        >
          {subtitle}
        </p>
      </div>
    </div>
  );
}

SectionHeader.propTypes = {
  icon: PropTypes.oneOf(['zap', 'sparkles']).isRequired,
  iconBg: PropTypes.string.isRequired,
  iconShadow: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string.isRequired,
};
