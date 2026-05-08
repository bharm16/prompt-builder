export const normalizeMotionString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export interface MotionMeta {
  hasGenerationParams: boolean;
  generationParamKeys: string[];
  hasCameraMotion: boolean;
  cameraMotionId: string | null;
  hasSubjectMotion: boolean;
  subjectMotionLength: number;
  hasKeyframes: boolean;
  keyframesCount: number;
}

export const extractMotionMeta = (
  generationParams?: Record<string, unknown>,
): MotionMeta => {
  const params = generationParams ?? {};
  const generationParamKeys = Object.keys(params);
  const cameraMotionId = normalizeMotionString(params.camera_motion_id);
  const subjectMotion = normalizeMotionString(params.subject_motion);
  const keyframesCount = Array.isArray(params.keyframes)
    ? params.keyframes.length
    : 0;

  return {
    hasGenerationParams: generationParamKeys.length > 0,
    generationParamKeys,
    hasCameraMotion: Boolean(cameraMotionId),
    cameraMotionId,
    hasSubjectMotion: Boolean(subjectMotion),
    subjectMotionLength: subjectMotion?.length ?? 0,
    hasKeyframes: keyframesCount > 0,
    keyframesCount,
  };
};
