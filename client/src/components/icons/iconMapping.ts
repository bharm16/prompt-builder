/**
 * Icon Mapping Utility
 * Maps Lucide React icon names to Geist UI icon names
 * 
 * This provides a migration path from lucide-react to Geist icons
 * while maintaining backward compatibility.
 */

import * as GeistIcons from '@geist-ui/icons';
import { logger } from '@/services/LoggingService';

/**
 * Mapping from Lucide icon names to Geist icon names
 * If a Geist equivalent doesn't exist, we use the closest match
 */
export const iconMapping: Record<string, keyof typeof GeistIcons> = {
  // Common icons
  'User': 'User',
  'Zap': 'Zap',
  'MapPin': 'MapPin',
  'Calendar': 'Calendar',
  'Palette': 'Grid',
  'Sparkles': 'Star',
  'Lightbulb': 'Zap',
  'Tag': 'Tag',
  'Target': 'Target',
  'Video': 'Video',
  'Film': 'Film',
  'Settings': 'Settings',
  'Volume2': 'Volume2',
  'Ruler': 'Divider', // Using Divider as alternative for Ruler
  'TreePine': 'Layers', // Using Layers as alternative for TreePine
  
  // Navigation icons
  'ChevronDown': 'ChevronDown',
  'ChevronRight': 'ChevronRight',
  'ChevronLeft': 'ChevronLeft',
  'ChevronUp': 'ChevronUp',
  'ArrowRight': 'ArrowRight',
  'ArrowLeft': 'ArrowLeft',
  'ArrowUp': 'ArrowUp',
  'ArrowDown': 'ArrowDown',
  'PanelLeft': 'ChevronLeft',
  'PanelRight': 'ChevronRight',
  
  // UI icons
  'Check': 'Check',
  'X': 'X',
  'Plus': 'Plus',
  'Minus': 'Minus',
  'Search': 'Search',
  'Filter': 'Filter',
  'MoreHorizontal': 'MoreHorizontal',
  'MoreVertical': 'MoreVertical',
  'Menu': 'Menu',
  'Close': 'X',
  
  // File/Document icons
  'File': 'File',
  'FileText': 'FileText',
  'Folder': 'Folder',
  'FolderOpen': 'Folder',
  
  // Media icons
  'Image': 'Image',
  'Camera': 'Camera',
  'Mic': 'Mic',
  'MicOff': 'MicOff',
  'Play': 'Play',
  'Pause': 'Pause',
  'Stop': 'StopCircle',
  
  // Status icons
  'CheckCircle': 'CheckCircle',
  'XCircle': 'XCircle',
  'AlertCircle': 'AlertCircle',
  'Info': 'Info',
  'Warning': 'AlertTriangle',
  
  // Action icons
  'Edit': 'Edit',
  'Trash': 'Trash',
  'Copy': 'Copy',
  'Download': 'Download',
  'Upload': 'Upload',
  'Share': 'Share',
  'Save': 'Save',
  
  // Layout icons
  'Grid': 'Grid',
  'Layout': 'Layout',
  'Sidebar': 'Sidebar',
  
  // Other common icons
  'Home': 'Home',
  'Star': 'Star',
  'Heart': 'Heart',
  'Bookmark': 'Bookmark',
  'Clock': 'Clock',
  'History': 'Clock',
  'Bell': 'Bell',
  'Mail': 'Mail',
  'Lock': 'Lock',
  'Unlock': 'Unlock',
  'LogIn': 'ArrowRight',
  'Eye': 'Eye',
  'EyeOff': 'EyeOff',
  'ExternalLink': 'ExternalLink',
  'Link': 'Link',
  'Code': 'Code',
  'Terminal': 'Terminal',
  'Database': 'Database',
  'Server': 'Server',
  'Globe': 'Globe',
  'Github': 'Github',
  'Twitter': 'Twitter',
  'Linkedin': 'Linkedin',
  'Slack': 'Slack',
} as const;

/**
 * Get Geist icon component by Lucide icon name
 */
export function getGeistIcon(lucideIconName: string): React.ComponentType<any> | null {
  const geistIconName = iconMapping[lucideIconName];
  if (!geistIconName) {
    logger.warn('No Geist icon mapping found', {
      component: 'iconMapping',
      lucideIconName,
    });
    return null;
  }
  
  const GeistIcon = GeistIcons[geistIconName];
  if (!GeistIcon) {
    logger.warn('Geist icon not found in @geist-ui/icons', {
      component: 'iconMapping',
      geistIconName,
      lucideIconName,
    });
    return null;
  }
  
  return GeistIcon as React.ComponentType<any>;
}

/**
 * Check if a Geist icon exists
 */
export function hasGeistIcon(lucideIconName: string): boolean {
  const geistIconName = iconMapping[lucideIconName];
  if (!geistIconName) return false;
  return geistIconName in GeistIcons;
}
