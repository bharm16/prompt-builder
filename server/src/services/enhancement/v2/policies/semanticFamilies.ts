import type { SemanticFamily } from '../types.js';

export const SEMANTIC_FAMILY_PATTERNS: Record<SemanticFamily, RegExp> = {
  action:
    /\b(grip(?:ping)?|grasp(?:ing)?|hold(?:ing)?|press(?:ing)?|rest(?:ing)?|steady(?:ing)?|turn(?:ing)?|curl(?:ing)?|clench(?:ing)?|squeez(?:ing)?|tap(?:ping)?|balance(?:ing)?|lean(?:ing)?|reach(?:ing)?|look(?:ing)?|gaze(?:ing)?|walk(?:ing)?|run(?:ning)?|jump(?:ing)?|smil(?:e|ing)|nod(?:ding)?|wav(?:e|ing))\b/i,
  audio: /\b(score|music|orchestra|ambient|sound|sfx|soundscape|chime|drone|percussion|choir)\b/i,
  camera_angle:
    /\b(eye[-\s]?level|low[-\s]?angle|high[-\s]?angle|overhead|bird'?s[-\s]?eye|worm'?s[-\s]?eye|dutch tilt|profile|point[-\s]?of[-\s]?view|pov)\b/i,
  camera_focus:
    /\b(focus|depth of field|dof|bokeh|defocus|blur|shallow|rack focus|selective focus|rear-plane blur)\b/i,
  camera_lens:
    /\b(\d+mm|lens|prime|telephoto|wide[-\s]?angle|anamorphic|macro|aperture|f\/\d(?:\.\d+)?|iris|f-number)\b/i,
  camera_movement:
    /\b(dolly|track(?:ing)?|pan|tilt|crane|zoom|handheld|static|push[-\s]?in|pull[-\s]?out|arc|locked[-\s]?off)\b/i,
  environment_context:
    /\b(window|windshield|glass|dashboard|cabin|cockpit|seat|upholstery|interior|rearview|mirror|condensation|reflection|dust|raindrops|fogged|haze|air|smoke|shadow|sunbeam|glare|trim|console)\b/i,
  environment_location:
    /\b(park|street|forest|beach|shoreline|lake|lakeside|dock|meadow|grove|city|cityscape|alley|playground|vineyard|field|trail|road|suburban|mountain|desert|plaza|garden|shore|coast|cliff|waterfront|courtyard|market|boardwalk|turnout|boulevard)\b/i,
  environment_weather:
    /\b(rain|rainfall|drizzle|downpour|storm|snow|snowfall|blizzard|fog|mist|breeze|wind|gust|overcast|sun shower|hail|thunder)\b/i,
  lighting_direction:
    /\b(left|right|front|rear|back|overhead|top[-\s]?lit|under[-\s]?lit|side[-\s]?lit|back[-\s]?lit|key|rim)\b/i,
  lighting_quality:
    /\b(soft|hard|diffused|diffuse|hazy|low[-\s]?key|high[-\s]?key|ambient|warm|cool|dim|bright|glow(?:ing)?|shadow(?:s)?|sunlit|moonlit|rim[-\s]?lit|backlit)\b/i,
  lighting_source:
    /\b(window|sunlight|sun|neon|candlelight|candle|lamplight|streetlamp|headlights|rim light|key light|practical light|overhead fluorescents?)\b/i,
  lighting_time_of_day:
    /\b(dawn|sunrise|morning|midday|noon|afternoon|golden hour|sunset|dusk|twilight|blue hour|night|daylight|daytime|evening|pre-dawn)\b/i,
  shot_type:
    /\b(extreme close[-\s]?up|close[-\s]?up|medium close[-\s]?up|medium shot|medium wide shot|wide shot|extreme wide shot|over[-\s]?the[-\s]?shoulder|bird'?s[-\s]?eye|worm'?s[-\s]?eye|insert shot|master shot|portrait framing)\b/i,
  style_aesthetic:
    /\b(aesthetic|look|tone|palette|grade|grading|grain|noir|neo-noir|documentary|verit[eé]|retro|vintage|kodachrome|8mm|16mm|35mm|cinematic|painterly|watercolor|impressionist|oil|ink|sepia|chiaroscuro|hyperreal|surreal|cyberpunk|cartoon|animation|pastel|monochrome|technicolor|dream(?:like)?|nostalg(?:ia|ic)|realism)\b/i,
  style_color_grade:
    /\b(desaturated|warm grade|cool grade|teal|amber|sepia|monochrome|high contrast|washed|muted|saturated|silver retention)\b/i,
  style_film_stock:
    /\b(kodak|fuji|agfa|ilford|tri-x|portra|ektachrome|velvia|super 8|8mm|16mm|35mm|film stock|celluloid|digital)\b/i,
  subject_appearance:
    /\b(face|cheeks?|eyes?|nose|lips?|mouth|brow|forehead|chin|jaw|expression|hands?|fingers?|palms?|knuckles?|nails?|hair|curls?|braids?|locks?|fringe|feet|foot|toes?|ankles?|heels?|socks?|shoes?|skin|freckles|build|frame|stature)\b/i,
  subject_identity:
    /\b(baby|infant|toddler|child|kid|boy|girl|person|man|woman|human|driver|runner|boxer|cowboy|alien|creature|performer|soldier|scientist)\b/i,
  technical_aspect_ratio: /\b(\d+:\d+|16:9|9:16|4:3|1:1|2\.39:1|aspect ratio)\b/i,
  technical_duration: /\b(\d+\s?(?:s|sec|secs|second|seconds)|duration|loop length)\b/i,
  technical_frame_rate: /\b(\d+fps|frames per second|24fps|30fps|60fps|120fps)\b/i,
  technical_resolution: /\b(720p|1080p|1440p|4k|6k|8k|resolution|uhd)\b/i,
  visual_abstract: /\b(hush|cascade|whisper|dream|memory|sentiment|essence|timeless|poetic|ethereal|mood|spirit)\b/i,
};

export const CATEGORY_LOCK_PATTERNS: Record<string, RegExp> = {
  camera: /\b(dolly|track(?:ing)?|pan|tilt|crane|zoom|handheld|static|lens|mm|wide shot|close[-\s]?up|angle|framing|focus|bokeh)\b/i,
  shot: /\b(wide shot|medium shot|close[-\s]?up|extreme close[-\s]?up|over[-\s]?the[-\s]?shoulder|shot|angle|framing)\b/i,
  lighting: /\b(light(?:ing)?|shadow|glow|illumina|backlight|rim light|key light|fill light|high[-\s]?key|low[-\s]?key|sunlight|moonlight)\b/i,
  technical: /\b(\d+fps|frame rate|aspect ratio|\d+:\d+|4k|8k|resolution|duration|mm film|film format)\b/i,
};

export const BODY_PART_PATTERNS = {
  face: /\b(face|cheeks?|eyes?|nose|lips?|mouth|brow|forehead|chin|jaw|expression)\b/i,
  hand: /\b(hands?|fingers?|palms?|knuckles?|nails?|thumbs?)\b/i,
  hair: /\b(hair|curls?|braids?|locks?|fringe)\b/i,
  feet: /\b(feet|foot|toes?|ankles?|heels?|socks?|shoes?)\b/i,
  prop: /\b(steering wheel|wheel|dashboard|window|glass|mirror|seat|console|toy|ring|stroller)\b/i,
};

export const ACTION_OBJECT_TERMS = [
  'steering wheel',
  'wheel',
  'dashboard',
  'window',
  'glass',
  'door',
  'toy',
];
