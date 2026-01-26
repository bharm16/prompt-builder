import React from 'react';

type IconProps = React.SVGProps<SVGSVGElement>;

const icon = (name: string) => (props: IconProps) =>
  React.createElement('svg', { 'data-icon': name, ...props });

export const ArrowLeft = icon('ArrowLeft');
export const BookOpen = icon('BookOpen');
export const ChevronDown = icon('ChevronDown');
export const Copy = icon('Copy');
export const Folder = icon('Folder');
export const GraduationCap = icon('GraduationCap');
export const Highlighter = icon('Highlighter');
export const Home = icon('Home');
export const Image = icon('Image');
export const Images = icon('Images');
export const Info = icon('Info');
export const LayoutGrid = icon('LayoutGrid');
export const Palette = icon('Palette');
export const Plus = icon('Plus');
export const ScanEye = icon('ScanEye');
export const Search = icon('Search');
export const Settings2 = icon('Settings2');
export const SlidersHorizontal = icon('SlidersHorizontal');
export const Sparkles = icon('Sparkles');
export const Trash2 = icon('Trash2');
export const Upload = icon('Upload');
export const Users = icon('Users');
export const Video = icon('Video');
export const Wand2 = icon('Wand2');

export type LucideIcon = (props: IconProps) => JSX.Element;
