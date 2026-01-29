Analyze this image for video generation constraints.
Return JSON only (no markdown, no extra text).

{
  "subject": {
    "type": "person|animal|object|scene|abstract",
    "description": "brief description (10 words max)",
    "position": "center|left|right|top|bottom|left-third|right-third"
  },
  "framing": {
    "shotType": "extreme-close-up|close-up|medium-close-up|medium|medium-wide|wide|extreme-wide",
    "angle": "eye-level|low-angle|high-angle|birds-eye|worms-eye|dutch|over-shoulder"
  },
  "lighting": {
    "quality": "natural|artificial|dramatic|flat|mixed",
    "timeOfDay": "day|night|golden-hour|blue-hour|indoor|unknown"
  },
  "confidence": 0.0-1.0
}

Be precise. Only describe what you clearly see.
