/**
 * Layout Components (Geist Design System)
 * 
 * Layout components are used to separate layout responsibilities from content
 * and interactivity. This is the separation of concerns that makes your app
 * maintainable and easy to reason about.
 * 
 * All components support Geist spacing tokens:
 * - geist-quarter (4pt ~5px)
 * - geist-half (8pt ~11px)
 * - geist-base (16pt ~21px)
 * 
 * Components:
 * - Box: Most fundamental layout component with Geist spacing support
 * - Flex: Organizes items along an axis using flexbox
 * - Grid: Organizes content in columns and rows
 * - Container: Provides consistent max-width (Geist content widths)
 * - Section: Provides consistent vertical spacing (Geist spacing scale)
 * 
 * Based on: https://vercel.com/geist
 */

export { Box, type BoxProps } from './Box';
export { Flex, type FlexProps } from './Flex';
export { Grid, type GridProps } from './Grid';
export { Container, type ContainerProps } from './Container';
export { Section, type SectionProps } from './Section';

