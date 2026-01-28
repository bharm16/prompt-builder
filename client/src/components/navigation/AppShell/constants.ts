/**
 * Static configuration for navigation system.
 *
 * @see STYLE_RULES.md Section 3 - No Magic Strings
 */

import { Clock, CreditCard, FileText, Home, MessageCircle, Package, Layers, Video } from '@promptstudio/system/components/ui';
import type { NavItem } from './types';

// -----------------------------------------------------------------------------
// Route Configuration
// -----------------------------------------------------------------------------

/** Routes that should show no shell (auth pages) */
export const AUTH_ROUTES = [
  '/signin',
  '/signup',
  '/forgot-password',
  '/email-verification',
  '/reset-password',
  '/account',
  '/login',
  '/register',
  '/settings/billing',
  '/settings/billing/invoices',
] as const;

/** Route prefixes that trigger sidebar variant */
export const WORKSPACE_ROUTE_PREFIXES = ['/prompt/'] as const;

/** Exact routes that trigger sidebar variant */
export const WORKSPACE_ROUTES_EXACT = ['/', '/create', '/assets', '/consistent'] as const;

// -----------------------------------------------------------------------------
// Navigation Items
// -----------------------------------------------------------------------------

/**
 * All navigation items with visibility configuration.
 *
 * - showInTopNav: Visible in horizontal marketing navbar
 * - showInSidebar: Visible in vertical workspace sidebar
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/home', label: 'Home', icon: Home, showInTopNav: false, showInSidebar: true },
  { to: '/assets', label: 'Assets', icon: Layers, showInTopNav: false, showInSidebar: true },
  { to: '/consistent', label: 'Consistency', icon: Video, showInTopNav: false, showInSidebar: true },
  { to: '/products', label: 'Products', icon: Package, showInTopNav: true, showInSidebar: true },
  { to: '/pricing', label: 'Pricing', icon: CreditCard, showInTopNav: true, showInSidebar: true },
  { to: '/docs', label: 'Docs', icon: FileText, showInTopNav: true, showInSidebar: true },
  { to: '/contact', label: 'Support', icon: MessageCircle, showInTopNav: true, showInSidebar: true },
  { to: '/history', label: 'History', icon: Clock, showInTopNav: true, showInSidebar: false },
] as const;

// -----------------------------------------------------------------------------
// Type Utilities
// -----------------------------------------------------------------------------

/** Derive literal types from routes */
export type AuthRoute = (typeof AUTH_ROUTES)[number];
export type WorkspaceRoutePrefix = (typeof WORKSPACE_ROUTE_PREFIXES)[number];
export type WorkspaceRouteExact = (typeof WORKSPACE_ROUTES_EXACT)[number];
