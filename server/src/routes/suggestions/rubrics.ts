import {
  VIDEO_RUBRIC,
  GENERAL_RUBRIC,
  type RubricDefinition,
} from "../../services/quality-feedback/config/judgeRubrics";

export type { RubricDefinition };

export function loadRubrics(): {
  video: RubricDefinition;
  general: RubricDefinition;
} {
  return {
    video: VIDEO_RUBRIC,
    general: GENERAL_RUBRIC,
  };
}
