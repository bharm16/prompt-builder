/**
 * Technical Example Bank - Director's Lexicon
 * 
 * Examples focused on cinematography terminology, film production language,
 * and technical video/photo concepts. Helps the model correctly identify
 * specialized terms like camera movements, lighting setups, and film stocks.
 * 
 * From PDF: "Director's Lexicon" - professional terminology that requires
 * domain expertise to label correctly.
 */

export const technicalExamples = [
  {
    input: "The camera dollies back as the astronaut floats weightlessly through the ISS corridor",
    output: {
      spans: [
        { text: "camera dollies back", role: "camera.movement", confidence: 0.95 },
        { text: "astronaut", role: "subject.identity", confidence: 0.9 },
        { text: "floats weightlessly", role: "action.movement", confidence: 0.9 },
        { text: "ISS corridor", role: "environment.location", confidence: 0.85 }
      ],
      meta: {
        version: "v3.0",
        notes: "Disambiguated camera movement from subject action"
      }
    },
    domains: ['cinematography', 'technical'],
    keywords: ['dolly', 'camera', 'movement', 'astronaut', 'corridor'],
    ambiguity: 'camera_vs_subject_movement'
  },

  {
    input: "Chef pans the vegetables in a hot pan while the camera pans left",
    output: {
      spans: [
        { text: "Chef", role: "subject.identity", confidence: 0.95 },
        { text: "pans the vegetables", role: "action.movement", confidence: 0.9 },
        { text: "hot pan", role: "environment.context", confidence: 0.85 },
        { text: "camera pans left", role: "camera.movement", confidence: 0.95 }
      ],
      meta: {
        version: "v3.0",
        notes: "Disambiguated 'pan' based on agent (Chef vs Camera)"
      }
    },
    domains: ['cinematography', 'ambiguous'],
    keywords: ['pan', 'pans', 'panning', 'camera', 'chef'],
    ambiguity: 'homonym_disambiguation'
  },

  {
    input: "35mm anamorphic lens, golden hour lighting creating chiaroscuro shadows",
    output: {
      spans: [
        { text: "35mm anamorphic", role: "style.filmStock", confidence: 0.95 },
        { text: "golden hour", role: "lighting.timeOfDay", confidence: 0.95 },
        { text: "chiaroscuro shadows", role: "lighting.quality", confidence: 0.9 }
      ],
      meta: {
        version: "v3.0",
        notes: "Applied Director's Lexicon: 35mm→filmStock, golden hour→timeOfDay"
      }
    },
    domains: ['cinematography', 'lighting', 'technical'],
    keywords: ['35mm', 'anamorphic', 'lens', 'golden hour', 'chiaroscuro', 'lighting'],
    ambiguity: 'technical_terminology'
  },

  {
    input: "Close-up on her face as the camera zooms out to reveal the room",
    output: {
      spans: [
        { text: "Close-up", role: "shot.type", confidence: 0.95 },
        { text: "her face", role: "subject.appearance", confidence: 0.9 },
        { text: "camera zooms out", role: "camera.movement", confidence: 0.95 },
        { text: "the room", role: "environment.location", confidence: 0.85 }
      ],
      meta: {
        version: "v3.0",
        notes: "Shot type (close-up) is static framing, zoom is camera movement"
      }
    },
    domains: ['cinematography', 'technical'],
    keywords: ['close-up', 'zoom', 'camera', 'face', 'room'],
    ambiguity: 'shot_type_vs_movement'
  },

  {
    input: "Handheld tracking shot with shallow depth of field at f/1.8, capturing the dancer's fluid motion",
    output: {
      spans: [
        { text: "Handheld tracking shot", role: "camera.movement", confidence: 0.95 },
        { text: "shallow depth of field", role: "camera.technique", confidence: 0.9 },
        { text: "f/1.8", role: "camera.settings", confidence: 0.95 },
        { text: "dancer", role: "subject.identity", confidence: 0.9 },
        { text: "fluid motion", role: "action.movement", confidence: 0.85 }
      ],
      meta: {
        version: "v3.0",
        notes: "Multiple technical camera terms correctly categorized"
      }
    },
    domains: ['cinematography', 'technical'],
    keywords: ['handheld', 'tracking', 'shallow', 'depth of field', 'f-stop', 'dancer'],
    ambiguity: 'multi_technical_terms'
  },

  {
    input: "Dutch angle shot with Rembrandt lighting and practical light sources in frame",
    output: {
      spans: [
        { text: "Dutch angle", role: "camera.angle", confidence: 0.95 },
        { text: "Rembrandt lighting", role: "lighting.setup", confidence: 0.95 },
        { text: "practical light sources", role: "lighting.type", confidence: 0.9 }
      ],
      meta: {
        version: "v3.0",
        notes: "Specialized lighting and camera terminology"
      }
    },
    domains: ['cinematography', 'lighting', 'technical'],
    keywords: ['dutch angle', 'rembrandt', 'lighting', 'practical', 'light'],
    ambiguity: 'lighting_techniques'
  },

  {
    input: "Crane shot descending from high angle to eye level, shot on Kodak Vision3 500T",
    output: {
      spans: [
        { text: "Crane shot", role: "camera.movement", confidence: 0.95 },
        { text: "descending", role: "camera.direction", confidence: 0.9 },
        { text: "high angle", role: "camera.angle", confidence: 0.9 },
        { text: "eye level", role: "camera.angle", confidence: 0.9 },
        { text: "Kodak Vision3 500T", role: "style.filmStock", confidence: 0.95 }
      ],
      meta: {
        version: "v3.0",
        notes: "Film stock and complex camera movement"
      }
    },
    domains: ['cinematography', 'technical'],
    keywords: ['crane', 'descending', 'high angle', 'eye level', 'kodak', 'film stock'],
    ambiguity: 'complex_camera_movement'
  },

  {
    input: "Rack focus from foreground to background as light trickles through volumetric fog",
    output: {
      spans: [
        { text: "Rack focus", role: "camera.technique", confidence: 0.95 },
        { text: "foreground", role: "shot.composition", confidence: 0.85 },
        { text: "background", role: "shot.composition", confidence: 0.85 },
        { text: "light trickles through", role: "lighting.behavior", confidence: 0.85 },
        { text: "volumetric fog", role: "lighting.atmosphere", confidence: 0.9 }
      ],
      meta: {
        version: "v3.0",
        notes: "Focus technique and atmospheric lighting"
      }
    },
    domains: ['cinematography', 'lighting', 'technical'],
    keywords: ['rack focus', 'foreground', 'background', 'volumetric', 'fog'],
    ambiguity: 'focus_technique'
  },

  {
    input: "Time-lapse of city lights with bokeh effect from wide aperture at f/2.0",
    output: {
      spans: [
        { text: "Time-lapse", role: "camera.technique", confidence: 0.95 },
        { text: "city lights", role: "subject.object", confidence: 0.85 },
        { text: "bokeh effect", role: "camera.technique", confidence: 0.9 },
        { text: "wide aperture", role: "camera.settings", confidence: 0.9 },
        { text: "f/2.0", role: "camera.settings", confidence: 0.95 }
      ],
      meta: {
        version: "v3.0",
        notes: "Time manipulation and technical aperture settings"
      }
    },
    domains: ['cinematography', 'technical'],
    keywords: ['time-lapse', 'bokeh', 'aperture', 'f-stop', 'city'],
    ambiguity: 'time_manipulation'
  },

  {
    input: "Steadicam operator follows subject through narrow alley, maintaining smooth glide",
    output: {
      spans: [
        { text: "Steadicam", role: "camera.equipment", confidence: 0.95 },
        { text: "operator", role: "production.crew", confidence: 0.85 },
        { text: "follows subject", role: "camera.movement", confidence: 0.9 },
        { text: "narrow alley", role: "environment.location", confidence: 0.85 },
        { text: "smooth glide", role: "camera.quality", confidence: 0.85 }
      ],
      meta: {
        version: "v3.0",
        notes: "Equipment and movement quality descriptors"
      }
    },
    domains: ['cinematography', 'technical', 'equipment'],
    keywords: ['steadicam', 'operator', 'follows', 'alley', 'smooth'],
    ambiguity: 'equipment_and_technique'
  }
];

