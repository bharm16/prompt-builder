import React from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'size'> {
  /**
   * Button variant style
   * @default 'primary'
   */
  variant?: 'primary' | 'secondary' | 'tertiary' | 'ghost';
  
  /**
   * Button size
   * @default 'medium'
   */
  size?: 'small' | 'medium' | 'large';
  
  /**
   * Button shape
   * @default 'default'
   */
  shape?: 'default' | 'rounded';
  
  /**
   * Show loading state
   * @default false
   */
  loading?: boolean;
  
  /**
   * Icon-only button (requires aria-label)
   * @default false
   */
  svgOnly?: boolean;
  
  /**
   * Prefix icon (before text)
   */
  prefix?: ReactNode;
  
  /**
   * Suffix icon (after text)
   */
  suffix?: ReactNode;
  
  /**
   * Button content
   */
  children?: ReactNode;
}

/**
 * Geist Button Component
 * 
 * Implements the Vercel Geist button design system.
 * Based on: https://vercel.com/geist/button
 * 
 * Features:
 * - Multiple variants (primary, secondary, tertiary, ghost)
 * - Three sizes (small, medium, large)
 * - Loading state
 * - Icon-only support
 * - Prefix/suffix icons
 * - Rounded shape option
 * - Full accessibility support
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'medium',
      shape = 'default',
      loading = false,
      svgOnly = false,
      prefix,
      suffix,
      children,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    // Base classes
    const baseClasses = [
      'inline-flex items-center justify-center',
      'transition-all duration-150',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
      'disabled:cursor-not-allowed disabled:opacity-60',
    ];

    // Size classes (using Geist typography)
    const sizeClasses = {
      small: [
        'px-geist-3 py-geist-2',
        'text-button-12', // 12px
        'h-8 min-h-8',
      ],
      medium: [
        'px-geist-4 py-geist-2',
        'text-button-14', // 14px - default
        'h-10 min-h-10',
      ],
      large: [
        'px-geist-6 py-geist-3',
        'text-button-16', // 16px
        'h-12 min-h-12',
      ],
    };

    // Shape classes
    const shapeClasses = {
      default: 'rounded-geist',
      rounded: 'rounded-full',
    };

    // Variant classes
    const variantClasses = {
      primary: [
        'bg-geist-foreground text-geist-background',
        'hover:bg-geist-accents-8',
        'active:bg-geist-accents-7',
        'focus-visible:ring-geist-accents-5',
      ],
      secondary: [
        'bg-geist-background text-geist-foreground',
        'border border-geist-accents-2',
        'hover:bg-geist-accents-1 hover:border-geist-accents-3',
        'active:bg-geist-accents-2',
        'focus-visible:ring-geist-accents-4',
      ],
      tertiary: [
        'bg-geist-accents-1 text-geist-foreground',
        'hover:bg-geist-accents-2',
        'active:bg-geist-accents-3',
        'focus-visible:ring-geist-accents-4',
      ],
      ghost: [
        'bg-transparent text-geist-accents-6',
        'hover:bg-geist-accents-1 hover:text-geist-foreground',
        'active:bg-geist-accents-2',
        'focus-visible:ring-geist-accents-4',
      ],
    };

    // Icon-only specific classes
    const iconOnlyClasses = svgOnly
      ? [
          size === 'small' ? 'w-8 h-8 p-0' : '',
          size === 'medium' ? 'w-10 h-10 p-0' : '',
          size === 'large' ? 'w-12 h-12 p-0' : '',
        ]
      : [];

    // Combine all classes
    const classes = [
      ...baseClasses,
      ...sizeClasses[size],
      shapeClasses[shape],
      ...variantClasses[variant],
      ...iconOnlyClasses,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        className={classes}
        disabled={isDisabled}
        aria-busy={loading}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {prefix && !loading && (
          <span className={svgOnly ? '' : 'mr-geist-2'}>{prefix}</span>
        )}
        {!svgOnly && children && (
          <span>{children}</span>
        )}
        {suffix && !loading && (
          <span className={svgOnly ? '' : 'ml-geist-2'}>{suffix}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

/**
 * ButtonLink Component
 * 
 * Link variant of Button that renders as an anchor tag.
 * Uses the same props as Button but renders <a> instead of <button>.
 */
export interface ButtonLinkProps extends Omit<ButtonProps, 'href'> {
  href: string;
  target?: string;
  rel?: string;
}

export const ButtonLink = React.forwardRef<HTMLAnchorElement, ButtonLinkProps>(
  (
    {
      href,
      target,
      rel,
      variant = 'primary',
      size = 'medium',
      shape = 'default',
      loading = false,
      svgOnly = false,
      prefix,
      suffix,
      children,
      className = '',
      ...props
    },
    ref
  ) => {
    // Base classes
    const baseClasses = [
      'inline-flex items-center justify-center',
      'transition-all duration-150',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
      'no-underline',
    ];

    // Size classes (using Geist typography)
    const sizeClasses = {
      small: [
        'px-geist-3 py-geist-2',
        'text-button-12',
        'h-8 min-h-8',
      ],
      medium: [
        'px-geist-4 py-geist-2',
        'text-button-14',
        'h-10 min-h-10',
      ],
      large: [
        'px-geist-6 py-geist-3',
        'text-button-16',
        'h-12 min-h-12',
      ],
    };

    // Shape classes
    const shapeClasses = {
      default: 'rounded-geist',
      rounded: 'rounded-full',
    };

    // Variant classes
    const variantClasses = {
      primary: [
        'bg-geist-foreground text-geist-background',
        'hover:bg-geist-accents-8',
        'active:bg-geist-accents-7',
        'focus-visible:ring-geist-accents-5',
      ],
      secondary: [
        'bg-geist-background text-geist-foreground',
        'border border-geist-accents-2',
        'hover:bg-geist-accents-1 hover:border-geist-accents-3',
        'active:bg-geist-accents-2',
        'focus-visible:ring-geist-accents-4',
      ],
      tertiary: [
        'bg-geist-accents-1 text-geist-foreground',
        'hover:bg-geist-accents-2',
        'active:bg-geist-accents-3',
        'focus-visible:ring-geist-accents-4',
      ],
      ghost: [
        'bg-transparent text-geist-accents-6',
        'hover:bg-geist-accents-1 hover:text-geist-foreground',
        'active:bg-geist-accents-2',
        'focus-visible:ring-geist-accents-4',
      ],
    };

    // Icon-only specific classes
    const iconOnlyClasses = svgOnly
      ? [
          size === 'small' ? 'w-8 h-8 p-0' : '',
          size === 'medium' ? 'w-10 h-10 p-0' : '',
          size === 'large' ? 'w-12 h-12 p-0' : '',
        ]
      : [];

    // Combine all classes
    const classes = [
      ...baseClasses,
      ...sizeClasses[size],
      shapeClasses[shape],
      ...variantClasses[variant],
      ...iconOnlyClasses,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <a
        ref={ref}
        href={href}
        target={target}
        rel={rel || (target === '_blank' ? 'noopener noreferrer' : undefined)}
        className={classes}
        {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {prefix && (
          <span className={svgOnly ? '' : 'mr-geist-2'}>{prefix}</span>
        )}
        {!svgOnly && children && (
          <span>{children}</span>
        )}
        {suffix && (
          <span className={svgOnly ? '' : 'ml-geist-2'}>{suffix}</span>
        )}
      </a>
    );
  }
);

ButtonLink.displayName = 'ButtonLink';

