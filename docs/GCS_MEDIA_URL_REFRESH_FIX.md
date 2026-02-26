# GCS Media URL Expiration Fix (Feb 4, 2026)

## Summary
Media previews (images/videos) went blank in the Prompt Optimizer because the app was using expired
GCS signed URLs and, for some videos, the original preview objects no longer existed.
We fixed this by refreshing URLs on demand, preventing stale history syncs from overwriting fresh
URLs, and serving videos from the persisted generation storage path when preview objects are gone.

## Symptoms
- Images and videos showed blank/failed states.
- Browser network showed repeated `429`/`400` errors for signed URLs.
- GCS responses included:
  - `ExpiredToken` (signed URL expired).
  - `NoSuchKey` for `video-previews/<assetId>` (preview object no longer exists).

## Root Causes
1. **Expired signed URLs** stored in history and reused later.
2. **State sync overwrote fresh URLs**:
   - The UI refreshed URLs but history/local storage sync reintroduced stale URLs.
3. **Video preview objects missing**:
   - `video-previews/<assetId>` objects were deleted/expired, so even fresh signed URLs failed.
   - The persisted generation video existed under `users/<uid>/generations/...`, but we weren’t
     using that path for refresh.

## Fixes Applied

### Client (refresh + persistence)
- **Refresh on load failure** for media:
  - `client/src/utils/refreshSignedUrl.ts` (new helper).
  - Used in:
    - `client/src/features/history/components/HistoryThumbnail.tsx`
    - `client/src/features/prompt-optimizer/GenerationsPanel/components/VideoThumbnail.tsx`
    - `client/src/features/prompt-optimizer/GenerationsPanel/components/KontextFrameStrip.tsx`
    - `client/src/components/MediaViewer/components/ImagePreview.tsx`
- **Prevent stale history overwrites**:
  - `client/src/features/prompt-optimizer/GenerationsPanel/hooks/useGenerationsState.ts`
  - Merges incoming generations with local state and prefers fresher signed URLs.

### Server (video fallback to persisted storage)
- **Use persisted generation storage when preview object missing**:
  - `server/src/routes/preview/handlers/videoAssetView.ts`
    - If a job exists and has `storagePath`, return a fresh signed URL for that path.
  - `server/src/routes/preview/handlers/videoJobs.ts`
    - Prefer `storagePath` signed URL; fall back to preview bucket if needed.
- **Avoid signing missing objects**:
  - `server/src/services/video-generation/storage/GcsVideoAssetStore.ts`
    - Check existence before generating a signed URL.

## How to Verify
1. Load a session with prior generations.
2. Network:
   - `GET /api/preview/video/view?assetId=...` returns `200` with a URL like:
     `https://storage.googleapis.com/<bucket>/users/<uid>/generations/...` (v4 signed).
   - Images load without `ExpiredToken`.
3. UI:
   - Images render in history + generation cards.
   - Video previews render (or show a fallback if truly missing).

## Notes / Guardrails
- Expired signed URLs are expected; the client must refresh them.
- If `video-previews/<assetId>` is missing, the persisted generation file is the source of truth.
- Make sure signed URLs are v4 and refreshed via:
  - `/api/storage/view-url?path=...` for `users/...` paths
  - `/api/preview/video/view?assetId=...` for video asset IDs

## If It Breaks Again (Quick Checklist)
- Check the Network tab for `ExpiredToken` or `NoSuchKey`.
- Confirm `/api/storage/view-url?path=users/...` returns a URL with a future `X-Goog-Expires`.
- Confirm `/api/preview/video/view?assetId=...` returns a `users/<uid>/generations/...` URL when previews are missing.

## Files Changed (Key)
- `client/src/utils/refreshSignedUrl.ts` (new)
- `client/src/features/prompt-optimizer/GenerationsPanel/hooks/useGenerationsState.ts`
- `client/src/features/prompt-optimizer/GenerationsPanel/components/VideoThumbnail.tsx`
- `client/src/features/prompt-optimizer/GenerationsPanel/components/KontextFrameStrip.tsx`
- `client/src/components/MediaViewer/components/ImagePreview.tsx`
- `client/src/features/history/components/HistoryThumbnail.tsx`
- `server/src/routes/preview/handlers/videoAssetView.ts`
- `server/src/routes/preview/handlers/videoJobs.ts`
- `server/src/services/video-generation/storage/GcsVideoAssetStore.ts`
- `server/src/services/image-generation/storage/GcsImageAssetStore.ts`
