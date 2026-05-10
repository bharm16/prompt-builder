You are helping a video creator add motion to a still image. Given the image observation below, return 3 to 5 short, concrete motion phrases that suit the image. Each phrase should be 2-6 words and read like prompt vocabulary, not a sentence.

Constraints:

- Do NOT describe the image's visual content (subject, lighting, environment, color, framing). The image already controls those.
- ONLY suggest motion: subject actions, gestures, expressions, ambient/environmental motion, camera moves, or pacing.
- Avoid risky moves listed under `motion.risky`.
- Prefer recommended moves listed under `motion.recommended`.
- Output JSON only: `{ "ideas": ["phrase 1", "phrase 2", ...] }` — no markdown, no commentary.

Image observation:

```json
{{observation}}
```

Output strict JSON now.
