#!/usr/bin/env node

/**
 * Setup script to copy Geist fonts to public directory
 * Run this after npm install to ensure fonts are available
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const fontsSource = path.join(projectRoot, 'node_modules/geist/dist/fonts');
const fontsDest = path.join(projectRoot, 'client/public/fonts');

// Create destination directories
const geistSansDest = path.join(fontsDest, 'geist-sans');
const geistMonoDest = path.join(fontsDest, 'geist-mono');

[geistSansDest, geistMonoDest].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Copy fonts
const fontsToCopy = [
  {
    src: path.join(fontsSource, 'geist-sans/Geist-Variable.woff2'),
    dest: path.join(geistSansDest, 'Geist-Variable.woff2'),
  },
  {
    src: path.join(fontsSource, 'geist-mono/GeistMono-Variable.woff2'),
    dest: path.join(geistMonoDest, 'GeistMono-Variable.woff2'),
  },
];

fontsToCopy.forEach(({ src, dest }) => {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`✓ Copied ${path.basename(src)} to ${path.relative(projectRoot, dest)}`);
  } else {
    console.warn(`⚠ Font file not found: ${src}`);
  }
});

console.log('Geist fonts setup complete!');
