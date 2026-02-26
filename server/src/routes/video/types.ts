import type { VideoConceptService } from '@services/video-concept/VideoConceptService';

export type VideoConceptServiceContract = Pick<
  VideoConceptService,
  | 'getCreativeSuggestions'
  | 'checkCompatibility'
  | 'detectConflicts'
  | 'completeScene'
  | 'getSmartDefaults'
  | 'generateVariations'
  | 'parseConcept'
>;

export interface VideoServices {
  videoConceptService: VideoConceptServiceContract;
}
