/**
 * Load Geist fonts for Vite/React
 * Since Geist package is designed for Next.js, we need to manually load fonts
 */

/**
 * Load Geist fonts for Vite/React
 * Fonts are copied to public/fonts directory so Vite can serve them as static assets
 */

export function loadGeistFonts(): void {
  // Create style element for Geist fonts
  // Using paths to public directory that Vite serves as static assets
  const style = document.createElement('style');
  style.textContent = `
    @font-face {
      font-family: 'Geist';
      src: url('/fonts/geist-sans/Geist-Variable.woff2') format('woff2');
      font-weight: 100 900;
      font-style: normal;
      font-display: swap;
    }

    @font-face {
      font-family: 'Geist Mono';
      src: url('/fonts/geist-mono/GeistMono-Variable.woff2') format('woff2');
      font-weight: 100 900;
      font-style: normal;
      font-display: swap;
    }
  `;
  document.head.appendChild(style);
}

