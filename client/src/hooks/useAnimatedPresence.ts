import { useEffect, useRef, useState } from "react";

export type AnimatedPresencePhase = "enter" | "entered" | "exit" | "exited";

interface UseAnimatedPresenceOptions {
  exitMs?: number;
}

const DEFAULT_EXIT_MS = 220;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const getInitialReducedMotion = (): boolean => {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return false;
  }

  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
};

function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(
    getInitialReducedMotion,
  );

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return undefined;
    }

    const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    const handleChange = (event: MediaQueryListEvent): void => {
      setPrefersReducedMotion(event.matches);
    };

    setPrefersReducedMotion(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  return prefersReducedMotion;
}

export function useAnimatedPresence(
  open: boolean,
  options: UseAnimatedPresenceOptions = {},
): { shouldRender: boolean; phase: AnimatedPresencePhase } {
  const exitMs = options.exitMs ?? DEFAULT_EXIT_MS;
  const prefersReducedMotion = usePrefersReducedMotion();
  const [shouldRender, setShouldRender] = useState<boolean>(open);
  const [phase, setPhase] = useState<AnimatedPresencePhase>(() => {
    if (!open) return "exited";
    return getInitialReducedMotion() ? "entered" : "enter";
  });
  const shouldRenderRef = useRef<boolean>(open);
  const firstRafRef = useRef<number | null>(null);
  const secondRafRef = useRef<number | null>(null);
  const exitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    shouldRenderRef.current = shouldRender;
  }, [shouldRender]);

  useEffect(() => {
    return () => {
      if (firstRafRef.current !== null) {
        window.cancelAnimationFrame(firstRafRef.current);
      }
      if (secondRafRef.current !== null) {
        window.cancelAnimationFrame(secondRafRef.current);
      }
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (firstRafRef.current !== null) {
      window.cancelAnimationFrame(firstRafRef.current);
      firstRafRef.current = null;
    }
    if (secondRafRef.current !== null) {
      window.cancelAnimationFrame(secondRafRef.current);
      secondRafRef.current = null;
    }
    if (exitTimerRef.current !== null) {
      window.clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }

    if (prefersReducedMotion) {
      setShouldRender(open);
      setPhase(open ? "entered" : "exited");
      return undefined;
    }

    if (open) {
      setShouldRender(true);
      setPhase("enter");
      firstRafRef.current = window.requestAnimationFrame(() => {
        firstRafRef.current = null;
        secondRafRef.current = window.requestAnimationFrame(() => {
          secondRafRef.current = null;
          setPhase("entered");
        });
      });
      return undefined;
    }

    if (!shouldRenderRef.current) {
      setPhase("exited");
      return undefined;
    }

    setPhase("exit");
    exitTimerRef.current = window.setTimeout(() => {
      exitTimerRef.current = null;
      setShouldRender(false);
      setPhase("exited");
    }, exitMs);

    return undefined;
  }, [exitMs, open, prefersReducedMotion]);

  return { shouldRender, phase };
}
