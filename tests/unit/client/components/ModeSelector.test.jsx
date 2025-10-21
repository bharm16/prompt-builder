import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import ModeSelector from '../ModeSelector.jsx';

const FakeIcon = () => <svg data-testid="icon" />;

const modes = [
  { id: 'code', name: 'Code', description: 'Coding help', icon: FakeIcon },
  { id: 'creative', name: 'Creative', description: 'Creative writing', icon: FakeIcon },
];

describe('ModeSelector', () => {
  const origInnerWidth = global.innerWidth;

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    global.innerWidth = origInnerWidth;
  });

  it('renders as tabs on desktop and changes mode on click', () => {
    global.innerWidth = 1200; // desktop
    const onModeChange = vi.fn();
    render(
      <ModeSelector modes={modes} selectedMode="code" onModeChange={onModeChange} />
    );

    const codeTab = screen.getByRole('tab', { name: /code/i });
    const creativeTab = screen.getByRole('tab', { name: /creative/i });
    expect(codeTab).toHaveAttribute('aria-selected', 'true');
    expect(creativeTab).toHaveAttribute('aria-selected', 'false');

    fireEvent.click(creativeTab);
    expect(onModeChange).toHaveBeenCalledWith('creative');
  });

  it('renders as dropdown on mobile and selects a mode', () => {
    global.innerWidth = 375; // mobile
    const onModeChange = vi.fn();
    render(
      <ModeSelector modes={modes} selectedMode="code" onModeChange={onModeChange} />
    );

    const toggle = screen.getByRole('button', { name: /current mode/i });
    fireEvent.click(toggle);

    const option = screen.getByRole('option', { name: /creative/i });
    fireEvent.click(option);
    expect(onModeChange).toHaveBeenCalledWith('creative');
  });
});
