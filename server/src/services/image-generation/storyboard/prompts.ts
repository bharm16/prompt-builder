import { STORYBOARD_FRAME_TIMESTAMPS, STORYBOARD_DURATION_SECONDS } from './constants';

const FALLBACK_TEMPORAL_KEYFRAMES = [
  'Mid-shot of the same subject, slightly further from camera, action progressed one beat forward, same lighting and environment visible at wider framing.',
  'Wide shot of the same subject at moderate distance, action at midpoint, environment now visible in full context, lighting consistent with base frame.',
  'Establishing wide shot, subject at far distance completing the action, full environment and sky visible, same lighting direction and atmosphere.',
];

export const buildSystemPrompt = (
  keyframeCount: number,
  timestamps: readonly number[] = STORYBOARD_FRAME_TIMESTAMPS
): string => {
  const duration = timestamps[timestamps.length - 1] ?? STORYBOARD_DURATION_SECONDS;
  const frameList = timestamps
    .slice(1, keyframeCount + 1)
    .map((time, index) => `  Frame ${index + 1} (${time.toFixed(1)}s)`)
    .join('\n');

  return `You are a cinematic storyboard planner.

You will receive a prompt describing a video scene. Return exactly ${keyframeCount} KEYFRAME DESCRIPTIONS for a ${duration}s video.

These keyframes will be generated as images using the base frame (Frame 0 at 0.0s) as a visual identity reference. Each keyframe must be a COMPLETE scene description, not a list of changes.

TIME POSITIONS:
${frameList}

OUTPUT FORMAT:
- Return ONLY valid JSON: {"deltas":["...","...","..."]}
- The "deltas" array must contain exactly ${keyframeCount} strings.

KEYFRAME RULES:
- Each keyframe is a COMPLETE SCENE DESCRIPTION for that moment in time. Describe the full frame as a standalone image prompt.
- Think cinematically: how does the camera framing change over ${duration} seconds? How far does the subject move?
- A person walks ~1.5m/s, runs ~3-4m/s, sprints ~7m/s. Use real physics for movement over the time span.
- Camera typically progresses: close-up -> mid-shot -> wide -> establishing, or vice versa. Choose the progression that serves the scene.
- CAMERA PERSPECTIVE LOCK: The camera angle relative to the subject is FIXED by Frame 0. If Frame 0 shows the subject from behind, ALL frames show from behind. If from the side, all from the side. The image generation model preserves the base frame's composition. Requesting a perspective flip (behind -> front, side -> overhead) produces incoherent results. Progression comes from shot SCALE (close -> wide), subject DISTANCE from camera, subject POSITION in frame, and environment reveals. NOT from camera angle changes.
- FRAME 1 MUST BE VISIBLY DIFFERENT: Even at the earliest timestamp, Frame 1 must show clear compositional change from Frame 0 — different shot scale, subject noticeably further/closer, or significant pose progression. If Frame 1 looks like Frame 0 with a minor pose tweak, it has failed.
- Each description MUST include: subject (identity, clothing, pose at that moment), framing (shot scale, camera angle), environment (what's visible at this framing), lighting (how it interacts with the subject at this distance).
- Preserve character identity details across all frames: same clothing, same build, same hair. Repeat these details in every description.
- Make temporal progression OBVIOUS. Frame 3 should look dramatically different from Frame 0 in composition/scale/framing.

ANTI-PATTERNS (do NOT do these):
- Micro-movements: "shift foot forward, tilt torso" - these are animation frames, not storyboard keyframes
- Edit commands: "Move X to Y, Add Z" - these are edit instructions, not scene descriptions
- Identical framing: all frames at same shot scale with minor pose changes
- Ignoring physics: subject in same position after 4 seconds of running
- Perspective flips: switching from "behind the subject" to "facing the subject" or changing camera angle between frames — the generation model cannot recompose camera perspective

GOOD KEYFRAME (complete scene at a moment):
"Wide shot from behind: woman in white sundress walking along shoreline, 8 meters ahead of starting position, ankle-deep in retreating wave, wet footprints trailing behind her, golden hour sun low on horizon casting long shadow to the right, ocean filling left half of frame"

BAD KEYFRAME (edit command):
"Shift the woman's right foot forward into the wet sand. Tilt her torso into the stride."`;
};

export const buildRepairSystemPrompt = (
  keyframeCount: number,
  timestamps: readonly number[] = STORYBOARD_FRAME_TIMESTAMPS
): string =>
  `${buildSystemPrompt(keyframeCount, timestamps)}

REPAIR MODE:
- The previous response was invalid JSON or did not match the schema.
- Return ONLY valid JSON with the exact schema and array length.`;

/**
 * Build the prompt sent to Kontext for each keyframe.
 *
 * In the temporal keyframe paradigm, the description IS the prompt.
 * The base image provides identity/style via Kontext's img_cond_path.
 */
export const buildEditPrompt = (basePrompt: string, temporalDescription: string): string => {
  const description = temporalDescription.trim();
  return description || basePrompt.trim();
};

export const buildFallbackDeltas = (expectedCount: number): string[] => {
  if (expectedCount <= 0) {
    return [];
  }
  const deltas: string[] = [];
  for (let index = 0; index < expectedCount; index += 1) {
    deltas.push(
      FALLBACK_TEMPORAL_KEYFRAMES[index % FALLBACK_TEMPORAL_KEYFRAMES.length] ??
        FALLBACK_TEMPORAL_KEYFRAMES[0]!
    );
  }
  return deltas;
};

/**
 * Build the user prompt for vision-based temporal keyframe planning.
 *
 * Sent alongside the base image to a vision LLM so it plans keyframes
 * based on what it actually sees rather than imagining from text.
 */
export const buildVisionDeltaUserPrompt = (textPrompt: string): string =>
  `The attached image is Frame 0 (the base frame at T=0.0s).

The creator described this scene as:
"${textPrompt.trim()}"

Study the image carefully - it is the ground truth for visual identity:
- Subject: exact appearance, clothing, build, coloring
- Environment: terrain, background elements, atmospheric conditions
- Lighting: key light direction, color temperature, shadow behavior
- Camera: current shot scale and angle

CRITICAL: The camera's viewing angle (from behind, from the side, etc.) is LOCKED to what you see in this image. All keyframes must maintain this same perspective. The generation model cannot change the camera angle — only the shot scale and subject distance can progress.

Now write temporal keyframe descriptions. Each must be a COMPLETE scene description that:
1. Maintains the exact visual identity you see (repeat clothing/appearance details)
2. Advances time realistically (use real-world physics for movement speed)
3. Progresses camera framing to show scene evolution
4. Could stand alone as an image generation prompt`;
