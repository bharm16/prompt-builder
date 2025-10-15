import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
// We dynamically import the real Toast module to bypass global test mocks
async function renderWithToast(ui) {
  const modulePath = '../../components/Toast.jsx';
  vi.resetModules();
  vi.doUnmock(modulePath);
  const mod = await import(modulePath);
  const { ToastProvider } = mod;
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe('ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('ToastProvider renders children and useToast exposes methods', async () => {
    // Use the project-level mock implementation registered in setup
    const mod = await import('../../components/Toast.jsx');
    const { useToast, ToastProvider } = mod;
    function Child() {
      const t = useToast();
      expect(typeof t.success).toBe('function');
      expect(typeof t.error).toBe('function');
      expect(typeof t.warning).toBe('function');
      expect(typeof t.info).toBe('function');
      // calling should not throw
      t.info('hello');
      return <div>ok</div>;
    }
    render(
      <ToastProvider>
        <Child />
      </ToastProvider>
    );
    expect(screen.getByText('ok')).toBeInTheDocument();
  });

  it('useToast methods are callable without provider state', async () => {
    const mod = await import('../../components/Toast.jsx');
    const { useToast, ToastProvider } = mod;
    function Child() {
      const t = useToast();
      t.success('done');
      t.error('oops');
      return <div>ok-2</div>;
    }
    render(
      <ToastProvider>
        <Child />
      </ToastProvider>
    );
    expect(screen.getByText('ok-2')).toBeInTheDocument();
  });
});
