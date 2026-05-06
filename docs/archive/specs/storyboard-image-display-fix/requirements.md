# Requirements Document

## Introduction

This document specifies the requirements for fixing the storyboard images display issue on the frontend. Storyboard images are generated and stored in GCS successfully, but they fail to display after the signed URL expires (1 hour). The root cause is that the URL refresh mechanism cannot reliably extract asset IDs from GCS signed URLs, causing silent failures when attempting to obtain fresh URLs.

The solution involves storing asset IDs alongside signed URLs when generation completes, enabling reliable URL refresh regardless of URL format changes.

## Glossary

- **Generation**: A record representing a generated media item (image, video, or image-sequence) with associated metadata and URLs
- **Storyboard**: A sequence of 4 keyframe images generated from a prompt, displayed as an image-sequence
- **GCS**: Google Cloud Storage, where generated images are stored
- **Signed_URL**: A time-limited URL that provides temporary access to a GCS object, expires after configured TTL (1 hour)
- **Asset_ID**: A UUID that uniquely identifies a stored image in GCS (e.g., `preview-images/{uuid}`)
- **Media_Refresh_Hook**: The `useGenerationMediaRefresh` hook that attempts to refresh expired URLs
- **KontextFrameStrip**: The React component that renders storyboard frames in a 4-frame grid
- **Generation_Card**: The React component that displays a single generation with its media

## Requirements

### Requirement 1: Store Asset IDs with Generation Data

**User Story:** As a system, I want to store asset IDs alongside signed URLs when storyboard generation completes, so that URL refresh can reliably obtain new signed URLs without parsing complex URL formats.

#### Acceptance Criteria

1. WHEN the backend generates storyboard images, THE Storyboard_Preview_Service SHALL return asset IDs for each generated image alongside the signed URLs
2. WHEN the frontend receives storyboard generation results, THE Generation_Actions_Hook SHALL store asset IDs in the generation object alongside mediaUrls
3. THE Generation type SHALL include an optional `mediaAssetIds` array field that maps 1:1 with `mediaUrls`
4. WHEN a generation has `mediaAssetIds`, THE Media_Refresh_Hook SHALL use stored asset IDs instead of parsing URLs

### Requirement 2: Reliable URL Refresh Mechanism

**User Story:** As a user, I want my storyboard images to remain visible after the signed URL expires, so that I can continue working with my generated content.

#### Acceptance Criteria

1. WHEN a signed URL expires and `mediaAssetIds` are available, THE Media_Refresh_Hook SHALL call the image view API with the stored asset ID to obtain a fresh signed URL
2. WHEN URL refresh succeeds, THE Media_Refresh_Hook SHALL update the generation's mediaUrls with the new signed URLs
3. WHEN URL refresh fails, THE Media_Refresh_Hook SHALL log the error with context (asset ID, generation ID, error message)
4. IF URL refresh fails and the original URL is expired, THEN THE KontextFrameStrip SHALL display an error state for the affected frame

### Requirement 3: Backend Asset ID Support

**User Story:** As a developer, I want the storyboard generation API to return asset IDs, so that the frontend can reliably refresh URLs.

#### Acceptance Criteria

1. WHEN the Image_Generation_Service stores an image to GCS, THE service SHALL return the asset ID (UUID) in the result
2. WHEN the Storyboard_Preview_Service generates frames, THE service SHALL collect asset IDs from each stored image
3. THE storyboard generation API response SHALL include an `assetIds` array in the data object alongside `imageUrls`
4. THE `assetIds` array SHALL have the same length and order as the `imageUrls` array

### Requirement 4: Backward Compatibility

**User Story:** As a user with existing generations, I want my old storyboard images to continue working, so that I don't lose access to previously generated content.

#### Acceptance Criteria

1. WHEN a generation does not have `mediaAssetIds`, THE Media_Refresh_Hook SHALL fall back to URL parsing for asset ID extraction
2. WHEN URL parsing fails for a legacy generation, THE Media_Refresh_Hook SHALL attempt to use the original URL
3. THE Generation type changes SHALL be backward compatible with existing persisted generation data

### Requirement 5: Error State and Retry

**User Story:** As a user, I want to see a clear error state when an image fails to load, with an option to retry, so that I understand what happened and can take action.

#### Acceptance Criteria

1. WHEN an image fails to load in KontextFrameStrip, THE component SHALL display a clear error indicator with a warning icon
2. WHEN an image is in error state, THE KontextFrameStrip SHALL display a retry button for that frame
3. WHEN the user clicks retry, THE component SHALL trigger a URL refresh for that specific frame
4. WHEN retry succeeds, THE component SHALL clear the error state and display the image
5. IF retry fails, THEN THE component SHALL keep the error state and show an appropriate message

### Requirement 6: Fresh Image Display

**User Story:** As a user, I want my generated storyboard images to display immediately after generation completes, so that I can see and select keyframes for video generation.

#### Acceptance Criteria

1. WHEN storyboard generation completes successfully, THE Generation_Card SHALL display all 4 frames within 2 seconds of receiving the response
2. WHEN images are loading, THE KontextFrameStrip SHALL show a shimmer animation placeholder
3. WHEN all images have loaded, THE KontextFrameStrip SHALL stop showing shimmer animations
4. THE KontextFrameStrip SHALL handle partial load states where some frames load before others
