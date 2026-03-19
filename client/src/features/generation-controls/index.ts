/**
 * Generation Controls Feature
 *
 * Owns model selection, aspect ratio, keyframes, camera motion,
 * and video generation parameter state management.
 */

export {
  GenerationControlsStoreProvider,
  useGenerationControlsStoreState,
  useGenerationControlsStoreActions,
  useGenerationControlsStore,
} from './context/GenerationControlsStore';

export type { GenerationControlsActions } from './context/GenerationControlsStore';

export type {
  GenerationControlsTab,
  ImageSubTab,
  ConstraintMode,
  VideoReferenceImage,
  ExtendVideoSource,
  GenerationControlsDomainState,
  GenerationControlsUIState,
  GenerationControlsState,
} from './context/generationControlsStoreTypes';

export { DEFAULT_GENERATION_CONTROLS_STATE } from './context/generationControlsStoreTypes';
