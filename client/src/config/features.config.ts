export const FEATURES = {
  CANVAS_FIRST_LAYOUT:
    import.meta.env.VITE_FEATURE_CANVAS_FIRST_LAYOUT !== "false",
} as const;
