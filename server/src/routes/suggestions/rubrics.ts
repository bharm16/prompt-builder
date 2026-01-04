declare const require: NodeRequire;

export interface RubricDefinition {
  [key: string]: unknown;
}

export function loadRubrics(): { video: RubricDefinition; general: RubricDefinition } {
  const { VIDEO_RUBRIC, GENERAL_RUBRIC } = require('../../services/quality-feedback/config/judgeRubrics');
  return {
    video: VIDEO_RUBRIC,
    general: GENERAL_RUBRIC,
  };
}
