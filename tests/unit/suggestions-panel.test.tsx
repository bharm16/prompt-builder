/**
 * Unit tests for SuggestionsPanel
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import SuggestionsPanel from '@components/SuggestionsPanel/SuggestionsPanel';
import { useSuggestionsState } from '@components/SuggestionsPanel/hooks/useSuggestionsState';
import { useCustomRequest } from '@components/SuggestionsPanel/hooks/useCustomRequest';

vi.mock('@hooks/useDebugLogger', () => ({
  useDebugLogger: () => ({
    logAction: vi.fn(),
    logEffect: vi.fn(),
  }),
}));

vi.mock('@components/SuggestionsPanel/hooks/useSuggestionsState', () => ({
  useSuggestionsState: vi.fn(),
}));

vi.mock('@components/SuggestionsPanel/hooks/useCustomRequest', () => ({
  useCustomRequest: vi.fn(),
}));

vi.mock('@components/SuggestionsPanel/components/PanelHeader', () => ({
  PanelHeader: ({ panelTitle }: { panelTitle?: string }) => (
    <div data-testid="panel-header">{panelTitle}</div>
  ),
}));

vi.mock('@components/SuggestionsPanel/components/CategoryTabs', () => ({
  CategoryTabs: () => <div data-testid="category-tabs" />,
}));

vi.mock('@components/SuggestionsPanel/components/CustomRequestForm', () => ({
  CustomRequestForm: () => <div data-testid="custom-request-form" />,
}));

vi.mock('@components/SuggestionsPanel/components/SuggestionsList', () => ({
  SuggestionsList: ({ suggestions }: { suggestions: unknown[] }) => (
    <div data-testid="suggestions-list">{suggestions.length}</div>
  ),
}));

vi.mock('@components/SuggestionsPanel/components/PanelStates', () => ({
  LoadingState: () => <div data-testid="loading-state" />,
  EmptyState: ({ emptyState }: { emptyState: { title: string } }) => (
    <div data-testid="empty-state">{emptyState.title}</div>
  ),
  ErrorState: ({ errorMessage }: { errorMessage?: string }) => (
    <div data-testid="error-state">{errorMessage}</div>
  ),
  InactiveState: ({ inactiveState }: { inactiveState: { title: string } }) => (
    <div data-testid="inactive-state">{inactiveState.title}</div>
  ),
}));

const mockUseSuggestionsState = vi.mocked(useSuggestionsState);
const mockUseCustomRequest = vi.mocked(useCustomRequest);

describe('SuggestionsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCustomRequest.mockReturnValue({
      customRequest: '',
      setCustomRequest: vi.fn(),
      handleCustomRequest: vi.fn(),
      isCustomLoading: false,
    });
  });

  describe('error handling', () => {
    it('renders the error state when suggestions fail', () => {
      mockUseSuggestionsState.mockReturnValue({
        categories: [],
        activeCategory: null,
        currentSuggestions: [],
        isLoading: false,
        hasCategories: false,
        isGroupedFormat: false,
        dispatch: vi.fn(),
        actions: { SET_ACTIVE_CATEGORY: 'SET_ACTIVE_CATEGORY' },
      });

      render(
        <SuggestionsPanel
          suggestionsData={{
            show: true,
            isError: true,
            errorMessage: 'Failed to load',
          }}
        />
      );

      expect(screen.getByTestId('error-state')).toHaveTextContent('Failed to load');
    });
  });

  describe('edge cases', () => {
    it('renders inactive state when panel is hidden', () => {
      mockUseSuggestionsState.mockReturnValue({
        categories: [],
        activeCategory: null,
        currentSuggestions: [],
        isLoading: false,
        hasCategories: false,
        isGroupedFormat: false,
        dispatch: vi.fn(),
        actions: { SET_ACTIVE_CATEGORY: 'SET_ACTIVE_CATEGORY' },
      });

      render(<SuggestionsPanel suggestionsData={{ show: false }} />);

      expect(screen.getByTestId('inactive-state')).toBeInTheDocument();
    });
  });

  describe('core behavior', () => {
    it('renders loading state and custom request controls', () => {
      mockUseSuggestionsState.mockReturnValue({
        categories: [{ category: 'Tone', suggestions: [] }],
        activeCategory: 'Tone',
        currentSuggestions: [],
        isLoading: false,
        hasCategories: true,
        isGroupedFormat: false,
        dispatch: vi.fn(),
        actions: { SET_ACTIVE_CATEGORY: 'SET_ACTIVE_CATEGORY' },
      });

      render(
        <SuggestionsPanel
          suggestionsData={{
            show: true,
            isLoading: true,
            showCategoryTabs: true,
            enableCustomRequest: true,
            panelTitle: 'Suggestions',
          }}
        />
      );

      expect(screen.getByTestId('loading-state')).toBeInTheDocument();
      expect(screen.getByTestId('category-tabs')).toBeInTheDocument();
      expect(screen.getByTestId('custom-request-form')).toBeInTheDocument();
      expect(screen.getByTestId('panel-header')).toHaveTextContent('Suggestions');
    });

    it('renders suggestions list when data is available', () => {
      mockUseSuggestionsState.mockReturnValue({
        categories: [{ category: 'All', suggestions: [{ text: 'A' }] }],
        activeCategory: 'All',
        currentSuggestions: [{ text: 'A' }],
        isLoading: false,
        hasCategories: true,
        isGroupedFormat: false,
        dispatch: vi.fn(),
        actions: { SET_ACTIVE_CATEGORY: 'SET_ACTIVE_CATEGORY' },
      });

      render(
        <SuggestionsPanel
          suggestionsData={{
            show: true,
            suggestions: [{ text: 'A' }],
            isLoading: false,
            isError: false,
          }}
        />
      );

      expect(screen.getByTestId('suggestions-list')).toHaveTextContent('1');
    });
  });
});
