import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ConceptPreview } from '../ConceptPreview';

describe('ConceptPreview', () => {
  describe('error handling', () => {
    it('returns null when text is empty', () => {
      const { container } = render(<ConceptPreview text="" />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('renders when text contains only whitespace', () => {
      render(<ConceptPreview text="   " />);
      expect(screen.getByText(/live concept preview/i)).toBeInTheDocument();
    });
  });

  describe('core behavior', () => {
    it('displays the provided preview text', () => {
      render(<ConceptPreview text="A vivid neon city" />);
      expect(screen.getByText('A vivid neon city')).toBeInTheDocument();
      expect(screen.getByText(/live concept preview/i)).toBeInTheDocument();
    });
  });
});
