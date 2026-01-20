import { useCallback, useEffect, useMemo, useState } from 'react';

export type DrawerPosition = 'left' | 'right' | 'bottom';
export type DrawerDisplayMode = 'push' | 'overlay' | 'fullscreen';
type Viewport = 'mobile' | 'tablet' | 'desktop';

interface UseDrawerStateOptions {
  defaultOpen?: boolean;
  storageKey?: string;
  position?: DrawerPosition;
  desktopMode?: 'push' | 'overlay';
}

interface DrawerState {
  isOpen: boolean;
  setIsOpen: (next: boolean) => void;
  open: () => void;
  close: () => void;
  toggle: () => void;
  displayMode: DrawerDisplayMode;
}

const getViewport = (): Viewport => {
  if (typeof window === 'undefined') return 'desktop';
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
};

export function useDrawerState({
  defaultOpen = true,
  storageKey,
  position = 'left',
  desktopMode = 'push',
}: UseDrawerStateOptions = {}): DrawerState {
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !storageKey) return defaultOpen;
    const stored = window.localStorage.getItem(storageKey);
    if (stored === 'true' || stored === 'false') {
      return stored === 'true';
    }
    return defaultOpen;
  });
  const [viewport, setViewport] = useState<Viewport>(getViewport);

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return;
    window.localStorage.setItem(storageKey, String(isOpen));
  }, [isOpen, storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = (): void => setViewport(getViewport());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const displayMode = useMemo<DrawerDisplayMode>(() => {
    if (position === 'bottom') {
      if (viewport === 'mobile') return 'fullscreen';
      if (viewport === 'tablet') return 'overlay';
      return desktopMode;
    }
    if (viewport === 'mobile') return 'fullscreen';
    if (viewport === 'tablet') return 'overlay';
    return desktopMode;
  }, [desktopMode, position, viewport]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const isEditable =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (isEditable) return;

      if (event.key === 'Escape' && isOpen) {
        event.preventDefault();
        close();
        return;
      }
      if (position === 'left' && event.key === '[') {
        event.preventDefault();
        toggle();
      }
      if (position === 'right' && event.key === ']') {
        event.preventDefault();
        toggle();
      }
      // Backtick toggles bottom drawer
      if (position === 'bottom' && (event.key === '`' || event.code === 'Backquote')) {
        event.preventDefault();
        toggle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [close, isOpen, position, toggle]);

  return { isOpen, setIsOpen, open, close, toggle, displayMode };
}
