import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AppShellProvider, useAppShell } from '../AppShellContext';

const wrapperWithProvider = () => ({ children }: { children: React.ReactNode }) => (
  <AppShellProvider>{children}</AppShellProvider>
);

describe('AppShellContext', () => {
  describe('error handling', () => {
    it('throws when useAppShell is used outside provider', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => renderHook(() => useAppShell())).toThrowError(
        'useAppShell must be used within an AppShellProvider'
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('core behavior', () => {
    it('updates convergence handoff data', () => {
      const { result } = renderHook(() => useAppShell(), {
        wrapper: wrapperWithProvider(),
      });

      act(() => {
        result.current.setConvergenceHandoff({
          prompt: 'Hello',
          lockedDimensions: [],
          previewImageUrl: '',
          cameraMotion: '',
          subjectMotion: '',
        });
      });

      expect(result.current.convergenceHandoff).toEqual({
        prompt: 'Hello',
        lockedDimensions: [],
        previewImageUrl: '',
        cameraMotion: '',
        subjectMotion: '',
      });
    });
  });
});
