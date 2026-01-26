import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import VideoConceptBuilder from '../../VideoConceptBuilder';
import { VideoConceptApi } from '../api/videoConceptApi';

const fetchSuggestionsMock = vi.fn();
const clearSuggestionsMock = vi.fn();
const fetchTechnicalParamsMock = vi.fn();

vi.mock('../hooks/useElementSuggestions', () => ({
  useElementSuggestions: () => ({
    fetchSuggestions: fetchSuggestionsMock,
    clearSuggestions: clearSuggestionsMock,
  }),
}));

vi.mock('../hooks/useConflictDetection', () => ({
  useConflictDetection: () => vi.fn(async () => {}),
}));

vi.mock('../hooks/useRefinements', () => ({
  useRefinements: () => vi.fn(async () => {}),
}));

vi.mock('../hooks/useTechnicalParams', () => ({
  useTechnicalParams: () => fetchTechnicalParamsMock,
}));

vi.mock('../hooks/useCompatibilityScores', () => ({
  useCompatibilityScores: () => vi.fn(),
}));

vi.mock('../hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: () => {},
}));

vi.mock('../../../hooks/useDebugLogger', () => ({
  useDebugLogger: () => ({
    logState: vi.fn(),
    logEffect: vi.fn(),
    logAction: vi.fn(),
    logError: vi.fn(),
    startTimer: vi.fn(),
    endTimer: vi.fn(),
  }),
}));

vi.mock('../../SuggestionsPanel', () => ({
  default: ({ suggestionsData }: { suggestionsData: { show?: boolean } }) => (
    <div data-testid="suggestions-panel" data-show={suggestionsData?.show ? 'true' : 'false'} />
  ),
}));

vi.mock('../api/videoConceptApi', () => ({
  VideoConceptApi: {
    parseConcept: vi.fn(),
    completeScene: vi.fn(),
  },
}));

describe('VideoConceptBuilder', () => {
  const mockParseConcept = vi.mocked(VideoConceptApi.parseConcept);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('keeps concept mode active when parsing fails', async () => {
      mockParseConcept.mockRejectedValueOnce(new Error('parse failed'));
      const onConceptComplete = vi.fn();

      render(<VideoConceptBuilder onConceptComplete={onConceptComplete} />);

      fireEvent.click(screen.getByRole('button', { name: /describe concept/i }));

      const textarea = screen.getByPlaceholderText(/sleek sports car/i);
      fireEvent.change(textarea, { target: { value: 'A neon city' } });

      fireEvent.click(screen.getByRole('button', { name: /parse into elements/i }));

      await waitFor(() => expect(mockParseConcept).toHaveBeenCalled());

      expect(screen.getByPlaceholderText(/sleek sports car/i)).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('disables generate prompt button when fewer than three elements are filled', () => {
      render(<VideoConceptBuilder onConceptComplete={vi.fn()} />);

      const generateButton = screen.getByRole('button', { name: /generate prompt/i });
      expect(generateButton).toBeDisabled();
    });
  });

  describe('core behavior', () => {
    it('calls onConceptComplete with generated prompt and technical params', async () => {
      fetchTechnicalParamsMock.mockResolvedValue({ camera: 'dolly' });
      const onConceptComplete = vi.fn();

      render(<VideoConceptBuilder onConceptComplete={onConceptComplete} />);

      const subjectInput = screen.getByPlaceholderText(/who\/what with 2-3 visual details/i);
      const actionInput = screen.getByPlaceholderText(/one specific action/i);
      const locationInput = screen.getByPlaceholderText(/specific place/i);

      fireEvent.change(subjectInput, { target: { value: 'cat' } });
      fireEvent.change(actionInput, { target: { value: 'jumping' } });
      fireEvent.change(locationInput, { target: { value: 'garden' } });

      const generateButton = screen.getByRole('button', { name: /generate prompt/i });
      expect(generateButton).toBeEnabled();

      fireEvent.click(generateButton);

      await waitFor(() => {
        expect(onConceptComplete).toHaveBeenCalledWith(
          expect.stringContaining('Subject: cat'),
          expect.objectContaining({ subject: 'cat', action: 'jumping', location: 'garden' }),
          expect.objectContaining({
            format: 'detailed',
            technicalParams: { camera: 'dolly' },
          })
        );
      });
    });
  });
});
