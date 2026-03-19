/**
 * Centralized regex pattern catalog for suggestion validation.
 *
 * These patterns detect semantic categories (camera, lighting, subject, etc.)
 * and are shared across the validation pipeline. Keeping them in one module
 * makes maintenance easier and avoids duplicating expressions.
 */

// ── Camera ──────────────────────────────────────────────
export const cameraMovementTerms =
  /\b(dolly|track(ing)?|pan|tilt|crane|zoom|handheld|static|push[-\s]?in|pull[-\s]?out|arc)\b/i;
export const cameraAngleTerms =
  /\b(eye[-\s]?level|low[-\s]?angle|high[-\s]?angle|overhead|bird'?s[-\s]?eye|worm'?s[-\s]?eye|dutch tilt|profile|point[-\s]?of[-\s]?view|pov)\b/i;
export const shotFramingTerms =
  /\b(shot|close[-\s]?up|medium shot|wide shot|extreme close[-\s]?up|over[-\s]?the[-\s]?shoulder|high[-\s]?angle|low[-\s]?angle|bird'?s[-\s]?eye|worm'?s[-\s]?eye|dutch tilt)\b/i;
export const cameraFocusTerms =
  /\b(focus|depth of field|dof|bokeh|defocus|blur|shallow|rack focus|selective focus)\b/i;
export const lensApertureTerms =
  /\b(\d+mm|lens|prime|telephoto|wide[-\s]?angle|anamorphic|macro|aperture|f\/\d(?:\.\d+)?|iris)\b/i;
export const cameraTechniqueTerms =
  /\b(dolly|track(ing)?|pan|tilt|crane|zoom|handheld|steadicam|shot|close[-\s]?up|wide[-\s]?angle|high[-\s]?angle|low[-\s]?angle|bird'?s[-\s]?eye|lens|mm|framing)\b/i;

// ── Lighting ────────────────────────────────────────────
export const lightSourceClauseTerms =
  /\b(from|through|window|rear window|windshield|backseat|overhead|side[-\s]?light(?:ing)?|back[-\s]?light(?:ing)?|front[-\s]?light(?:ing)?|key light|rim light|sunlight|neon|candlelight)\b/i;
export const lightingClauseVerbTerms =
  /\b(create|creating|casting|streams?|streaming|pouring|bouncing|to create)\b/i;
export const timeOfDayTerms =
  /\b(dawn|sunrise|morning|midday|noon|afternoon|golden hour|sunset|dusk|twilight|blue hour|night|moonlit|daylight|daytime|evening)\b/i;
export const lightingQualityCueTerms =
  /\b(light|lighting|shadow(?:s)?|glow(?:ing)?|lumin(?:ous|ance)|radian(?:t|ce)|illuminat|warmth|brightness|dim(?:ness)?|diffus(?:e|ed|ion)|ambient|backlit|rim[-\s]?lit|high[-\s]?key|low[-\s]?key|sunlit|moonlit|golden[-\s]?hour)\b/i;
export const lightingDirectionTerms =
  /\b(left|right|front|rear|back|overhead|top[-\s]?lit|under[-\s]?lit|side[-\s]?lit|back[-\s]?lit|key|rim)\b/i;
export const shadowCueTerms = /\bshadow(s|y)?\b/i;
export const canonicalTimeTokens =
  /\b(dawn|sunrise|morning|midday|noon|afternoon|golden hour|sunset|dusk|twilight|blue hour|night|daylight|daytime|evening)\b/i;
export const abstractVisualTerms =
  /\b(hush|cascade|whisper|dream|memory|sentiment|essence|timeless|poetic|ethereal)\b/i;

// ── Style ───────────────────────────────────────────────
export const styleStrongCueTerms =
  /\b(style|aesthetic|look|tone|palette|grade|grading|grain|noir|neo-noir|documentary|verit[eé]|retro|vintage|kodachrome|8mm|16mm|35mm|cinematic|painterly|watercolor|impressionist|oil|ink|sepia|chiaroscuro|hyperreal|surreal|cyberpunk|cartoon|animation|diorama|pastel|monochrome|technicolor|dream(?:like)?|fantasy|whimsy|wonder|nostalg(?:ia|ic)|realism)\b/i;
export const styleNounCueTerms =
  /\b(technicolor|film|look|palette|grading|grade|effect|overlay|vignette|finish|texture|wash|filter)\b/i;

// ── Environment ─────────────────────────────────────────
export const externalLocationTerms =
  /\b(park|street|forest|beach|shoreline|lake|lakeside|dock|meadow|grove|city|cityscape|alley|playground|vineyard|field|trail|road|suburban|mountain|desert|plaza|garden|shore|coast|cliff|waterfront|courtyard|market|boardwalk|turnout|boulevard)\b/i;
export const environmentContextTerms =
  /\b(window|windshield|glass|dashboard|cabin|cockpit|seat|upholstery|interior|rearview|mirror|condensation|reflection|dust|raindrops|fogged|haze|air|smoke|shadow|sunbeam|glare|trim|console)\b/i;
export const vehicleInteriorTerms =
  /\b(car|vehicle|driver|seat|steering|wheel|window|windows|dashboard|cockpit|cabin|front seat|backseat|passenger seat|truck|van|bus|kart|go-kart|convertible|tractor|train|boat|airplane|stroller|tricycle)\b/i;
export const vehicleInteriorAnchorTerms =
  /\b(driver'?s seat|passenger seat|front seat|backseat|dashboard|steering wheel|cockpit|cabin|car interior|inside the car|inside the vehicle)\b/i;
export const environmentMotionSubjectTerms =
  /\b(tree|trees|leaf|leaves|branch|branches|grass|waves?|water|wind|breeze|clouds?|rain|snow|mist|fog)\b/i;

// ── Subject ─────────────────────────────────────────────
export const humanSubjectTerms =
  /\b(baby|infant|toddler|child|kid|boy|girl|person|man|woman|human)\b/i;
export const nonHumanIdentityTerms =
  /\b(puppy|dog|kitten|cat|bunny|rabbit|duckling|duck|bird|animal|creature|elephant|horse|bear|wolf|fox|lion|tiger|deer)\b/i;
export const fantasyOrRoleShiftTerms =
  /\b(cartoon|anime|mascot|puppet|doll|clown|robot|android|alien|monster)\b/i;
export const humanBodyActionTerms =
  /\b(clapping|grinning|smiling|waving|nodding|laughing|twisting body|look behind|reaching out|bouncing|tapping|tap(?:s|ping)?|reaching|reach(?:es|ing)?|wriggling|wriggle(?:s|ing)?|tiny fingers?|dashboard|steering wheel|hands?|arms?|feet)\b/i;
export const fullBodyActionTerms =
  /\b(leaning|looking|gazing|smiling|grinning|laughing|bouncing|walking|running|kicking|jumping|reaching forward)\b/i;
export const handInteractionTerms =
  /\b(grip(?:ping)?|grasp(?:ing)?|hold(?:ing)?|press(?:ing)?|rest(?:ing)?|steady(?:ing)?|turn(?:ing)?|curl(?:ing)?|clench(?:ing)?|squeez(?:ing)?|tap(?:ping)?|balance(?:ing)?)\b/i;

// ── Body parts / props ──────────────────────────────────
export const faceCueTerms =
  /\b(face|cheeks?|rosy-cheeked|eyes?|nose|lips?|mouth|brow|forehead|chin|jaw|expression)\b/i;
export const handCueTerms =
  /\b(hands?|fingers?|palms?|knuckles?|nails?|fists?|thumb|thumbs)\b/i;
export const hairCueTerms = /\b(hair|curls?|braids?|locks?|fringe)\b/i;
export const feetCueTerms = /\b(feet|foot|toes?|ankles?|heels?|socks?|shoes?)\b/i;
export const propCueTerms =
  /\b(steering wheel|wheel|dashboard|window|glass|mirror|seat|console|toy|ring|stroller)\b/i;

// ── Weather ─────────────────────────────────────────────
export const weatherGentleAirTerms =
  /\b(breeze|wind|air current|draft|gust|zephyr)\b/i;
export const weatherDisruptiveTerms =
  /\b(snow|snowfall|blizzard|hail|storm|thunder|rain|downpour|fog|mist|hurricane|tornado)\b/i;

// ── Misc grammar ────────────────────────────────────────
export const technicalVerbLeadTerms =
  /\b(streams?|pours?|falls?|glows?|shines?|filters?|casts?|renders?)\s*$/i;

// ── Locked category patterns ────────────────────────────
export const lockedCategoryPatterns: Record<string, RegExp> = {
  camera: /\b(dolly|track(ing)?|pan|tilt|crane|zoom|handheld|static|lens|mm|wide shot|close[-\s]?up|over[-\s]?the[-\s]?shoulder|angle|framing)\b/i,
  shot: /\b(wide shot|medium shot|close[-\s]?up|extreme close[-\s]?up|over[-\s]?the[-\s]?shoulder|shot|angle)\b/i,
  lighting: /\b(lighting|shadow|glow|illuminat|backlight|rim light|key light|fill light|high[-\s]?key|low[-\s]?key|sunlight|moonlight)\b/i,
  technical: /\b(\d+fps|frame rate|aspect ratio|\d+:\d+|4k|8k|resolution|duration|mm film|film format)\b/i,
};
