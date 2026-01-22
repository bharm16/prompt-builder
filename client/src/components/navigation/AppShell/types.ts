/**
 * Type definitions for AppShell navigation system.
 *
 * @see ARCHITECTURE_STANDARD.md Section 1 - Frontend Component Structure
 */

import type { ComponentType, ReactNode } from 'react';
import type { User } from '@hooks/types';
import type { ToolSidebarProps } from '@components/ToolSidebar/types';

// -----------------------------------------------------------------------------
// Navigation Item Types
// -----------------------------------------------------------------------------

/** Icon component type for nav items */
export type IconComponent = ComponentType<{ className?: string; size?: number }>;

/** Single navigation item configuration */
export interface NavItem {
  readonly to: string;
  readonly label: string;
  readonly icon: IconComponent;
  readonly showInTopNav: boolean;
  readonly showInSidebar: boolean;
}

/** Available shell variants based on route */
export type ShellVariant = 'topnav' | 'sidebar' | 'none';
// -----------------------------------------------------------------------------
// Component Props
// -----------------------------------------------------------------------------

/** Props for BrandLogo component */
export interface BrandLogoProps {
  readonly variant: 'topnav' | 'sidebar' | 'sidebar-collapsed';
  readonly className?: string;
}

/** Props for NavLinks component */
export interface NavLinksProps {
  readonly items: readonly NavItem[];
  readonly variant: 'horizontal' | 'vertical' | 'vertical-collapsed';
  readonly className?: string;
}

/** Props for UserMenu component */
export interface UserMenuProps {
  readonly user: User | null;
  readonly variant: 'topnav' | 'sidebar';
  readonly className?: string;
}

/** Props for TopNavbar variant */
export interface TopNavbarProps {
  readonly navItems: readonly NavItem[];
  readonly user: User | null;
}

/** Props for main AppShell component */
export interface AppShellProps extends Partial<Omit<ToolSidebarProps, 'user'>> {
  readonly children: ReactNode;
  readonly showHistory?: boolean;
  readonly onToggleHistory?: (show: boolean) => void;
}

// -----------------------------------------------------------------------------
// Hook Return Types
// -----------------------------------------------------------------------------

/** Categorized nav items for each variant */
export interface NavItemsByVariant {
  readonly topNav: readonly NavItem[];
  readonly sidebar: readonly NavItem[];
}

/** Return type for useNavigationConfig hook */
export interface NavigationConfig {
  readonly variant: ShellVariant;
  readonly navItems: NavItemsByVariant;
  readonly currentPath: string;
}
