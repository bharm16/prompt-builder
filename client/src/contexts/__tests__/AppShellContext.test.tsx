import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AppShellProvider, useAppShell } from '../AppShellContext';

const wrapperWithProvider = (props?: { isGeneratingCheck?: () => boolean; initialTool?: 'create' | 'studio' }) =>
  ({ children }: { children: React.ReactNode }) => (
    <AppShellProvider
      isGeneratingCheck={props?.isGeneratingCheck}
      initialTool={props?.initialTool}
    >
      {children}
    </AppShellProvider>
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

    it('blocks tool switch when generation is in progress and user cancels', () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

      const { result } = renderHook(() => useAppShell(), {
        wrapper: wrapperWithProvider({ isGeneratingCheck: () => true, initialTool: 'studio' }),
      });

      act(() => {
        result.current.setActiveTool('create');
      });

      expect(confirmSpy).toHaveBeenCalled();
      expect(result.current.activeTool).toBe('studio');

      confirmSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('does not prompt when switching to the same tool', () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

      const { result } = renderHook(() => useAppShell(), {
        wrapper: wrapperWithProvider({ isGeneratingCheck: () => true, initialTool: 'studio' }),
      });

      act(() => {
        result.current.setActiveTool('studio');
      });

      expect(confirmSpy).not.toHaveBeenCalled();
      expect(result.current.activeTool).toBe('studio');

      confirmSpy.mockRestore();
    });
  });

  describe('core behavior', () => {
    it('switches tools when confirmation is accepted', () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

      const { result } = renderHook(() => useAppShell(), {
        wrapper: wrapperWithProvider({ isGeneratingCheck: () => true, initialTool: 'studio' }),
      });

      act(() => {
        result.current.setActiveTool('create');
      });

      expect(result.current.activeTool).toBe('create');
      expect(confirmSpy).toHaveBeenCalled();

      confirmSpy.mockRestore();
    });

    it('updates convergence handoff data', () => {
      const { result } = renderHook(() => useAppShell(), {
        wrapper: wrapperWithProvider({ initialTool: 'studio' }),
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
