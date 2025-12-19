/**
 * Icon System Exports
 * 
 * Provides Geist icons integration for the design system
 */

export { Icon, createIconComponent } from './Icon';
export type { IconProps, IconSize, GeistIconName } from './Icon';
export { iconMapping, getGeistIcon, hasGeistIcon } from './iconMapping';

// Re-export commonly used Geist icons for convenience
export {
  User,
  Video,
  Film,
  Settings,
  Volume2,
  Target,
  Calendar,
  MapPin,
  Palette,
  Tag,
  Zap,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Check,
  X,
  Plus,
  Minus,
  Search,
  Filter,
  Menu,
  Grid,
  Layout,
  Code,
  Terminal,
  Database,
  Server,
  Globe,
  Github,
  Twitter,
  Linkedin,
} from '@geist-ui/icons';

