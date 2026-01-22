import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TriggerAutocomplete } from '../components/TriggerAutocomplete';

describe('TriggerAutocomplete', () => {
  it('renders suggestions and handles selection', () => {
    const suggestions = [
      { id: '1', type: 'character', trigger: '@Alice', name: 'Alice' },
    ];
    const onSelect = vi.fn();

    render(
      <TriggerAutocomplete
        isOpen
        suggestions={suggestions}
        selectedIndex={0}
        position={{ top: 0, left: 0 }}
        isLoading={false}
        onSelect={onSelect}
        onClose={vi.fn()}
        setSelectedIndex={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Alice'));
    expect(onSelect).toHaveBeenCalledWith(suggestions[0]);
  });
});
