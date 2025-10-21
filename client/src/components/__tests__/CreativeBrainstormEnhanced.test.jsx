import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, beforeEach, it, expect } from 'vitest';
import CreativeBrainstormEnhanced from '../CreativeBrainstormEnhanced.jsx';

const subjectPlaceholder = /Who\/what/i;
const actionPlaceholder = /ONE specific action/i;
const locationPlaceholder = /Specific place/i;

const setupFetchMocks = ({
  conflicts = [],
  refinements = {},
  technicalParams = {},
} = {}) => {
  global.fetch.mockImplementation((url) => {
    if (url === '/api/check-compatibility') {
      return Promise.resolve({ ok: true, json: async () => ({ score: 0.9 }) });
    }

    if (url === '/api/detect-conflicts') {
      return Promise.resolve({ ok: true, json: async () => ({ conflicts }) });
    }

    if (url === '/api/get-refinements') {
      return Promise.resolve({ ok: true, json: async () => ({ refinements }) });
    }

    if (url === '/api/generate-technical-params') {
      return Promise.resolve({ ok: true, json: async () => ({ technicalParams }) });
    }

    if (url === '/api/get-creative-suggestions') {
      return Promise.resolve({ ok: true, json: async () => ({ suggestions: [] }) });
    }

    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
};

describe('CreativeBrainstormEnhanced', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  const populateCoreElements = async () => {
    const subjectInput = screen.getByPlaceholderText(subjectPlaceholder);
    const actionInput = screen.getByPlaceholderText(actionPlaceholder);
    const locationInput = screen.getByPlaceholderText(locationPlaceholder);

    fireEvent.change(subjectInput, { target: { value: 'Time-traveling diver' } });
    fireEvent.change(actionInput, { target: { value: 'flying through currents' } });
    fireEvent.change(locationInput, { target: { value: 'ancient underwater city' } });

    return { subjectInput, actionInput, locationInput };
  };

  it('renders API-driven conflicts, refinements, and technical parameters', async () => {
    setupFetchMocks({
      conflicts: [
        {
          message: 'Underwater flight is inconsistent.',
          resolution: 'Swap for a swimming movement.',
        },
      ],
      refinements: {
        action: ['gliding with graceful strokes'],
      },
      technicalParams: {
        camera: {
          movement: 'slow pan',
          lens: '24mm wide',
        },
      },
    });

    render(<CreativeBrainstormEnhanced onConceptComplete={vi.fn()} />);

    await populateCoreElements();

    expect(await screen.findByText(/Potential Conflicts Detected/i)).toBeInTheDocument();
    expect(screen.getByText('Underwater flight is inconsistent.')).toBeInTheDocument();
    expect(screen.getByText('Swap for a swimming movement.')).toBeInTheDocument();

    expect(await screen.findByText(/AI Refinement Suggestions/i)).toBeInTheDocument();
    expect(screen.getByText('gliding with graceful strokes')).toBeInTheDocument();

    expect(await screen.findByText(/Technical Blueprint/i)).toBeInTheDocument();
    expect(screen.getByText(/slow pan/i)).toBeInTheDocument();
  });

  it('applies refinement suggestions when clicked', async () => {
    setupFetchMocks({
      refinements: {
        action: ['synchronized swimming'],
      },
      technicalParams: {},
    });

    render(<CreativeBrainstormEnhanced onConceptComplete={vi.fn()} />);

    const { actionInput } = await populateCoreElements();

    const refinementButton = await screen.findByText('synchronized swimming');
    await userEvent.click(refinementButton);

    await waitFor(() => {
      expect(actionInput).toHaveValue('synchronized swimming');
    });
  });
});
