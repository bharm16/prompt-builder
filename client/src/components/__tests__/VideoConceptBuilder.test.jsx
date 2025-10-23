import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, beforeEach, it, expect } from 'vitest';
import VideoConceptBuilder from '../VideoConceptBuilder.jsx';

const subjectPlaceholder = /Who\/what/i;
const actionPlaceholder = /ONE specific action/i;
const locationPlaceholder = /Specific place/i;

const setupFetchMocks = ({
  conflicts = [],
  refinements = {},
  technicalParams = {},
} = {}) => {
  global.fetch.mockImplementation((url, options = {}) => {
    if (url === '/api/video/validate') {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          compatibility: { score: 0.9, conflicts: [], suggestions: [] },
          conflicts,
        }),
      });
    }

    if (url === '/api/video/complete') {
      const body = options.body ? JSON.parse(options.body) : {};
      const response = { suggestions: body.existingElements || {} };

      if (body.smartDefaultsFor === 'technical') {
        response.smartDefaults = { technical: technicalParams };
      } else {
        response.smartDefaults = { refinements };
      }

      return Promise.resolve({ ok: true, json: async () => response });
    }

    if (url === '/api/video/suggestions') {
      return Promise.resolve({ ok: true, json: async () => ({ suggestions: [] }) });
    }

    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
};

describe('VideoConceptBuilder', () => {
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

    render(<VideoConceptBuilder onConceptComplete={vi.fn()} />);

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

    render(<VideoConceptBuilder onConceptComplete={vi.fn()} />);

    const { actionInput } = await populateCoreElements();

    const refinementButton = await screen.findByText('synchronized swimming');
    await userEvent.click(refinementButton);

    await waitFor(() => {
      expect(actionInput).toHaveValue('synchronized swimming');
    });
  });
});
