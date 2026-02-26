import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PromptInsertionBusProvider, usePromptInsertionBus } from '../PromptInsertionBusContext';

interface BusObserverProps {
  onCapture: (value: ReturnType<typeof usePromptInsertionBus>) => void;
}

function BusObserver({ onCapture }: BusObserverProps): React.ReactElement {
  const value = usePromptInsertionBus();

  React.useEffect(() => {
    onCapture(value);
  }, [onCapture, value]);

  return <></>;
}

describe('PromptInsertionBusProvider', () => {
  it('keeps insertAtCaret identity stable while still using latest prompt text', async () => {
    const setInputPrompt = vi.fn();
    const clearResultsView = vi.fn();
    const onCapture = vi.fn();

    const renderTree = (inputPrompt: string): React.ReactElement => (
      <PromptInsertionBusProvider
        inputPrompt={inputPrompt}
        setInputPrompt={setInputPrompt}
        clearResultsView={clearResultsView}
      >
        <BusObserver onCapture={onCapture} />
      </PromptInsertionBusProvider>
    );

    const { rerender } = render(renderTree('first prompt'));

    await waitFor(() => {
      expect(onCapture).toHaveBeenCalled();
    });

    const firstBus = onCapture.mock.lastCall?.[0] as ReturnType<typeof usePromptInsertionBus>;
    expect(firstBus).toBeDefined();

    rerender(renderTree('second prompt'));

    await waitFor(() => {
      const latestBus = onCapture.mock.lastCall?.[0] as ReturnType<typeof usePromptInsertionBus>;
      expect(latestBus).toBeDefined();
      expect(latestBus.insertAtCaret).toBe(firstBus.insertAtCaret);
    });

    const latestBus = onCapture.mock.lastCall?.[0] as ReturnType<typeof usePromptInsertionBus>;
    act(() => {
      latestBus.insertAtCaret('character');
    });

    expect(setInputPrompt).toHaveBeenCalledWith('second prompt, @character');
    expect(clearResultsView).toHaveBeenCalledTimes(1);
  });
});
