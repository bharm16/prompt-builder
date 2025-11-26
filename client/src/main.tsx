import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initSentry } from './config/sentry';
import { loadGeistFonts } from './utils/loadGeistFonts';

// Load Geist fonts
loadGeistFonts();

// Initialize Sentry before rendering
initSentry();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

